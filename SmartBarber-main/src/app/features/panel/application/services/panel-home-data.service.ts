import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { AuthSession, UserRole } from '../../../../core/auth/model/auth-session.model';
import { ReservationService } from '../../../reservations/services/reservation.service';
import { HistoryScope, ReservationHistoryItem } from '../../../reservations/models/reservation.model';
import { BarberShopApiService } from '../../../barber-shop/infrastructure/services/barber-shop-api.service';
import { ScheduleResponse } from '../../../barber-shop/domain/models/schedule.model';

/** Estados de una reserva que ya no ocupan la agenda. */
const CLOSED_STATUSES = new Set(['CANCELLED', 'COMPLETED', 'NO_SHOW', 'EXPIRED', 'DECLINED']);

/** Estados que no cuentan como servicio pedido (el resumen semanal los ignora). */
const DISCARDED_STATUSES = new Set(['CANCELLED', 'EXPIRED', 'DECLINED']);

const STATUS_LABELS: Readonly<Record<string, string>> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  IN_PROGRESS: 'En atención',
  WAITING: 'En espera',
  COMPLETED: 'Finalizada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No asistió'
};

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Cuántas citas se listan en las tarjetas del Inicio. */
const LIST_LIMIT = 5;

/** Reserva lista para mostrar en el Inicio. */
export interface HomeTurn {
  id: string;
  start: Date;
  end: Date;
  barberName: string | null;
  status: string;
  statusLabel: string;
}

/** Jornada configurada de un barbero (el horario es el mismo todos los días). */
export interface BarberWorkday {
  name: string;
  /** "08:00 a 18:00", o null si no tiene horario. */
  workday: string | null;
  /** "12:00 a 13:00", o null si no tiene almuerzo. */
  lunch: string | null;
  vacation: boolean;
}

/** Barra del resumen semanal (lunes a domingo de la semana en curso). */
export interface WeekBar {
  label: string;
  count: number;
  isToday: boolean;
  /** Altura relativa 0–100 respecto al día con más reservas. */
  height: number;
}

export interface LoadState<T> {
  loading: boolean;
  error: string;
  data: T;
}

const idle = <T>(data: T): LoadState<T> => ({ loading: false, error: '', data });

/**
 * Datos del Inicio del panel según el rol:
 *  - ADMIN:  reservas de la barbería, jornadas del equipo, barberos activos e ingresos del mes.
 *  - BARBER: sus reservas y su jornada.
 *  - CLIENT: sus reservas (próximas e historial reciente).
 *
 * Cada consulta falla de forma independiente: una tarjeta con error no impide
 * que las demás se muestren.
 */
@Injectable({ providedIn: 'root' })
export class PanelHomeDataService {

  private readonly reservationService = inject(ReservationService);
  private readonly barberShopApi = inject(BarberShopApiService);
  private readonly http = inject(HttpClient);

  /** Rol para el que se cargaron los datos. */
  readonly role = signal<UserRole | null>(null);

  readonly reservations = signal<LoadState<ReservationHistoryItem[]>>(idle([]));
  readonly workdays = signal<LoadState<BarberWorkday[]>>(idle([]));
  /** Barberos con la cuenta activa (solo ADMIN). */
  readonly activeBarbers = signal<LoadState<number | null>>(idle(null));
  /** Ingresos del mes en curso, solo servicios finalizados (solo ADMIN). */
  readonly monthRevenue = signal<LoadState<number | null>>(idle(null));

  /** Nombre de cada barbero por id, para mostrar quién atiende cada cita. */
  private readonly barberNames = signal<ReadonlyMap<string, string>>(new Map());

  /** Sesión ya cargada: evita repetir las consultas cada vez que la sesión emite. */
  private loadedKey: string | null = null;

  // ------------------------------------------------------------------ derivados

  private readonly turns = computed<HomeTurn[]>(() => {
    const names = this.barberNames();
    return this.reservations().data
      .map(item => this.toTurn(item, names))
      .filter((turn): turn is HomeTurn => turn !== null);
  });

  /** Citas de hoy que siguen activas, de la más temprana a la más tarde. */
  readonly todayTurns = computed<HomeTurn[]>(() =>
    this.turns()
      .filter(turn => isSameDay(turn.start, new Date()) && !CLOSED_STATUSES.has(turn.status))
      .sort(byStartAsc)
  );

  /** Citas activas desde ahora en adelante. */
  readonly upcomingTurns = computed<HomeTurn[]>(() => {
    const now = Date.now();
    return this.turns()
      .filter(turn => turn.end.getTime() >= now && !CLOSED_STATUSES.has(turn.status))
      .sort(byStartAsc);
  });

  /** Citas activas a partir de mañana (para el barbero). */
  readonly laterTurnsCount = computed<number>(() => {
    const tomorrow = startOfDay(addDays(new Date(), 1)).getTime();
    return this.upcomingTurns().filter(turn => turn.start.getTime() >= tomorrow).length;
  });

  readonly nextTurn = computed<HomeTurn | null>(() => this.upcomingTurns()[0] ?? null);

  /** Primeras citas para las listas de las tarjetas. */
  readonly todayList = computed<HomeTurn[]>(() => this.todayTurns().slice(0, LIST_LIMIT));
  readonly upcomingList = computed<HomeTurn[]>(() => this.upcomingTurns().slice(0, LIST_LIMIT));

  /** Últimas citas que ya pasaron o se cerraron (historial reciente del cliente). */
  readonly recentHistory = computed<HomeTurn[]>(() => {
    const now = Date.now();
    return this.turns()
      .filter(turn => turn.start.getTime() < now || CLOSED_STATUSES.has(turn.status))
      .sort((a, b) => b.start.getTime() - a.start.getTime())
      .slice(0, 3);
  });

  readonly completedCount = computed<number>(() =>
    this.turns().filter(turn => turn.status === 'COMPLETED').length
  );

  /** Reservas no canceladas por día de la semana en curso. */
  readonly week = computed<WeekBar[]>(() => {
    const monday = startOfWeek(new Date());
    const counts = new Array<number>(7).fill(0);

    for (const turn of this.turns()) {
      if (DISCARDED_STATUSES.has(turn.status)) {
        continue;
      }
      const index = Math.floor((startOfDay(turn.start).getTime() - monday.getTime()) / DAY_MS);
      if (index >= 0 && index < 7) {
        counts[index]++;
      }
    }

    const max = Math.max(...counts, 0);
    const todayIndex = Math.floor((startOfDay(new Date()).getTime() - monday.getTime()) / DAY_MS);

    return counts.map((count, i) => ({
      label: WEEKDAY_LABELS[i],
      count,
      isToday: i === todayIndex,
      height: max > 0 ? Math.round((count / max) * 100) : 0
    }));
  });

  readonly weekTotal = computed<number>(() => this.week().reduce((acc, day) => acc + day.count, 0));

  // ------------------------------------------------------------------ carga

  load(session: AuthSession): void {
    const key = [session.role, session.barbershopId, session.barberId, session.clientId].join('|');
    if (key === this.loadedKey) {
      return;
    }

    this.reset();
    this.loadedKey = key;
    this.role.set(session.role);

    switch (session.role) {
      case 'ADMIN':
        if (session.barbershopId) {
          this.loadTeam(session.barbershopId, null);
          this.loadReservations('barbershop', session.barbershopId);
          this.loadActiveBarbers();
          this.loadMonthRevenue();
        }
        break;
      case 'BARBER':
        if (session.barbershopId && session.barberId) {
          this.loadTeam(session.barbershopId, session.barberId);
          this.loadReservations('employee', session.barberId);
        }
        break;
      case 'CLIENT':
        if (session.clientId) {
          this.loadReservations('customer', session.clientId, true);
        }
        break;
    }
  }

  /** Vuelve a consultar todo (botón "Actualizar" o regreso al Inicio). */
  refresh(session: AuthSession): void {
    this.loadedKey = null;
    this.load(session);
  }

  /** Al cerrar sesión se olvidan los datos. */
  reset(): void {
    this.loadedKey = null;
    this.role.set(null);
    this.reservations.set(idle([]));
    this.workdays.set(idle([]));
    this.activeBarbers.set(idle(null));
    this.monthRevenue.set(idle(null));
    this.barberNames.set(new Map());
  }

  // ------------------------------------------------------------------ consultas

  private loadReservations(scope: HistoryScope, id: string, resolveBarberNames = false): void {
    this.reservations.set({ loading: true, error: '', data: [] });

    this.reservationService.getReservationHistory(scope, id).subscribe({
      next: items => {
        this.reservations.set(idle(items));
        if (resolveBarberNames) {
          this.loadBarberNamesFor(items);
        }
      },
      error: () => this.reservations.set({
        loading: false,
        error: 'No fue posible consultar las reservas.',
        data: []
      })
    });
  }

  /**
   * Equipo de la barbería: nombres de los barberos y su jornada.
   * @param onlyEmployeeId si se indica, solo se consulta la jornada de ese barbero.
   */
  private loadTeam(barbershopId: string, onlyEmployeeId: string | null): void {
    this.workdays.set({ loading: true, error: '', data: [] });

    this.barberShopApi.getEmployeesByBarbershop(barbershopId)
      .pipe(map(raw => toEmployees(raw)))
      .subscribe({
        next: employees => {
          this.mergeBarberNames(employees);
          this.loadWorkdays(onlyEmployeeId
            ? employees.filter(employee => employee.id === onlyEmployeeId)
            : employees);
        },
        error: () => this.workdays.set({
          loading: false,
          error: 'No fue posible consultar el equipo.',
          data: []
        })
      });
  }

  private loadWorkdays(employees: TeamEmployee[]): void {
    if (employees.length === 0) {
      this.workdays.set(idle([]));
      return;
    }

    const requests: Observable<BarberWorkday>[] = employees.map(employee =>
      this.barberShopApi.obtenerHorarioEmpleadoPorEmpleadoId(employee.id).pipe(
        map(schedule => toWorkday(employee.name, schedule)),
        // Sin horario configurado el backend responde con error: se muestra "Sin horario".
        catchError(() => of(toWorkday(employee.name, null)))
      )
    );

    forkJoin(requests).subscribe(data => this.workdays.set(idle(data)));
  }

  /** El cliente puede reservar en varias barberías: se consultan los barberos de cada una. */
  private loadBarberNamesFor(items: ReservationHistoryItem[]): void {
    const barbershopIds = [...new Set(items.map(item => item.barbershopId).filter(Boolean))];

    for (const barbershopId of barbershopIds) {
      // El cliente solo puede consultar los barberos reservables (sin datos personales).
      this.barberShopApi.getBookableBarbers(barbershopId)
        .pipe(
          map(raw => toEmployees(raw)),
          catchError(() => of([] as TeamEmployee[]))
        )
        .subscribe(employees => this.mergeBarberNames(employees));
    }
  }

  /** GET /employee-service/team (solo ADMIN): barberos con la cuenta activa, sin el administrador. */
  private loadActiveBarbers(): void {
    this.activeBarbers.set({ loading: true, error: '', data: null });

    this.http.get<Array<{ status?: string | null; role?: string | null }> | null>(
      `${environment.apiUrl}/employee-service/team`
    ).subscribe({
      next: team => this.activeBarbers.set(idle(
        (team ?? []).filter(member => member.status === 'ACTIVE' && member.role !== 'ADMIN').length
      )),
      error: () => this.activeBarbers.set({
        loading: false,
        error: 'No fue posible consultar el equipo.',
        data: null
      })
    });
  }

  /**
   * GET /statistics-service/dashboard (solo ADMIN) del 1 del mes a hoy: el mismo
   * valor de "Ingresos operacionales" de Estadísticas.
   */
  private loadMonthRevenue(): void {
    this.monthRevenue.set({ loading: true, error: '', data: null });

    const today = new Date();
    const params = new HttpParams()
      .set('from', toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)))
      .set('to', toIsoDate(today));

    this.http.get<{ current?: { revenue?: number | null } | null }>(
      `${environment.apiUrl}/statistics-service/dashboard`,
      { params }
    ).subscribe({
      next: response => this.monthRevenue.set(idle(Number(response?.current?.revenue ?? 0))),
      error: () => this.monthRevenue.set({
        loading: false,
        error: 'No fue posible consultar los ingresos.',
        data: null
      })
    });
  }

  // ------------------------------------------------------------------ utilidades

  private mergeBarberNames(employees: TeamEmployee[]): void {
    this.barberNames.update(current => {
      const next = new Map(current);
      employees.forEach(employee => next.set(employee.id, employee.name));
      return next;
    });
  }

  private toTurn(item: ReservationHistoryItem, names: ReadonlyMap<string, string>): HomeTurn | null {
    const start = new Date(item.startTime);
    if (isNaN(start.getTime())) {
      return null;
    }

    const status = String(item.status ?? '').toUpperCase();
    const endFromApi = item.endTime ? new Date(item.endTime) : null;
    const end = endFromApi && !isNaN(endFromApi.getTime())
      ? endFromApi
      : new Date(start.getTime() + (Number(item.duration) || 0) * 60_000);

    return {
      id: item.id,
      start,
      end,
      barberName: names.get(item.employeeId) ?? null,
      status,
      statusLabel: STATUS_LABELS[status] ?? status
    };
  }
}

// -------------------------------------------------------------------- funciones

interface TeamEmployee {
  id: string;
  name: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toEmployees(raw: unknown[]): TeamEmployee[] {
  return (raw as Array<Record<string, unknown>>)
    .map(employee => ({
      id: String(employee['id'] ?? ''),
      name: String(employee['name'] ?? '').trim() || 'Sin nombre'
    }))
    .filter(employee => employee.id);
}

function toWorkday(name: string, schedule: ScheduleResponse | null): BarberWorkday {
  const hhmm = (value: string | null | undefined) => value ? value.slice(0, 5) : null;
  const start = hhmm(schedule?.startTime);
  const end = hhmm(schedule?.endTime);
  const lunchStart = hhmm(schedule?.lunchStartTime);
  const lunchEnd = hhmm(schedule?.lunchEndTime);

  return {
    name,
    workday: start && end ? `${start} a ${end}` : null,
    lunch: lunchStart && lunchEnd ? `${lunchStart} a ${lunchEnd}` : null,
    vacation: Boolean(schedule?.vacation)
  };
}

function byStartAsc(a: HomeTurn, b: HomeTurn): number {
  return a.start.getTime() - b.start.getTime();
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Lunes de la semana de la fecha. */
function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  const offset = (day.getDay() + 6) % 7; // lunes = 0
  return addDays(day, -offset);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
