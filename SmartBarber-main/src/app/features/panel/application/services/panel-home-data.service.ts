import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';

import { AuthSession } from '../../../../core/auth/model/auth-session.model';
import { ReservationService } from '../../../reservations/services/reservation.service';
import { HistoryScope, ReservationHistoryItem } from '../../../reservations/models/reservation.model';
import { BarberShopApiService } from '../../../barber-shop/infrastructure/services/barber-shop-api.service';
import { ScheduleResponse } from '../../../barber-shop/domain/models/schedule.model';

/** Estados de reserva que no cuentan como turno pendiente del día. */
const INACTIVE_STATUSES = new Set(['CANCELLED', 'COMPLETED', 'NO_SHOW', 'EXPIRED', 'DECLINED']);

const STATUS_LABELS: Readonly<Record<string, string>> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  IN_PROGRESS: 'En atención',
  WAITING: 'En espera'
};

/** Turno de hoy listo para mostrar. */
export interface TodayTurn {
  id: string;
  start: Date;
  end: Date;
  barberName: string | null;
  statusLabel: string;
}

/** Jornada configurada de un barbero. */
export interface BarberWorkday {
  name: string;
  /** "08:00 a 18:00", o null si no tiene horario. */
  workday: string | null;
  /** "12:00 a 13:00", o null si no tiene almuerzo. */
  lunch: string | null;
  vacation: boolean;
}

export interface LoadState<T> {
  loading: boolean;
  error: string;
  data: T;
}

/**
 * Datos de las tarjetas del Inicio del panel: los turnos de hoy y la jornada
 * configurada de cada barbero (el horario es el mismo todos los días).
 */
@Injectable({ providedIn: 'root' })
export class PanelHomeDataService {

  private readonly reservations = inject(ReservationService);
  private readonly barberShopApi = inject(BarberShopApiService);

  readonly todayTurns = signal<LoadState<TodayTurn[]>>({ loading: false, error: '', data: [] });
  readonly workdays = signal<LoadState<BarberWorkday[]>>({ loading: false, error: '', data: [] });

  /** Sesión ya cargada: evita repetir las consultas cada vez que la sesión emite. */
  private loadedKey: string | null = null;

  load(session: AuthSession): void {
    const key = [session.role, session.barbershopId, session.barberId, session.clientId].join('|');
    if (key === this.loadedKey) {
      return;
    }
    this.loadedKey = key;

    const barbershopId = session.barbershopId;

    if (session.role === 'ADMIN' && barbershopId) {
      this.loadTeamData(barbershopId, null, 'barbershop', barbershopId);
    } else if (session.role === 'BARBER' && session.barberId && barbershopId) {
      this.loadTeamData(barbershopId, session.barberId, 'employee', session.barberId);
    } else if (session.role === 'CLIENT' && session.clientId) {
      this.loadTurns('customer', session.clientId, new Map());
      this.workdays.set({ loading: false, error: '', data: [] });
    }
  }

    /** Al cerrar sesión se olvidan los datos para que el próximo ingreso los consulte de nuevo. */
  reset(): void {
    this.loadedKey = null;
    this.todayTurns.set({ loading: false, error: '', data: [] });
    this.workdays.set({ loading: false, error: '', data: [] });
  }

  /** Nombres del equipo → turnos de hoy y jornadas. */
  private loadTeamData(
    barbershopId: string,
    onlyEmployeeId: string | null,
    scope: HistoryScope,
    scopeId: string
  ): void {
    this.workdays.set({ loading: true, error: '', data: [] });
    this.todayTurns.set({ loading: true, error: '', data: [] });

    this.barberShopApi.getEmployeesByBarbershop(barbershopId)
      .pipe(catchError(() => of([] as unknown[])))
      .subscribe(rawEmployees => {
        const employees = (rawEmployees as Array<Record<string, unknown>>)
          .map(e => ({ id: String(e['id'] ?? ''), name: String(e['name'] ?? '').trim() || 'Sin nombre' }))
          .filter(e => e.id && (!onlyEmployeeId || e.id === onlyEmployeeId));

        const names = new Map(employees.map(e => [e.id, e.name]));
        this.loadTurns(scope, scopeId, names);
        this.loadWorkdays(employees);
      });
  }

  private loadTurns(scope: HistoryScope, id: string, names: Map<string, string>): void {
    this.todayTurns.set({ loading: true, error: '', data: [] });

    this.reservations.getReservationHistory(scope, id).subscribe({
      next: items => this.todayTurns.set({
        loading: false,
        error: '',
        data: this.toTodayTurns(items, names)
      }),
      error: () => this.todayTurns.set({
        loading: false,
        error: 'No fue posible consultar los turnos de hoy.',
        data: []
      })
    });
  }

  private loadWorkdays(employees: { id: string; name: string }[]): void {
    if (employees.length === 0) {
      this.workdays.set({ loading: false, error: '', data: [] });
      return;
    }

    const requests: Observable<BarberWorkday>[] = employees.map(employee =>
      this.barberShopApi.obtenerHorarioEmpleadoPorEmpleadoId(employee.id).pipe(
        map(schedule => this.toWorkday(employee.name, schedule)),
        // Sin horario configurado el backend responde con error: se muestra "Sin horario".
        catchError(() => of(this.toWorkday(employee.name, null)))
      )
    );

    forkJoin(requests).subscribe({
      next: data => this.workdays.set({ loading: false, error: '', data }),
      error: () => this.workdays.set({
        loading: false,
        error: 'No fue posible consultar los horarios del equipo.',
        data: []
      })
    });
  }

  private toTodayTurns(items: ReservationHistoryItem[], names: Map<string, string>): TodayTurn[] {
    const today = new Date();
    const isToday = (d: Date) =>
      d.getFullYear() === today.getFullYear()
      && d.getMonth() === today.getMonth()
      && d.getDate() === today.getDate();

    return items
      .map(item => ({ item, start: new Date(item.startTime) }))
      .filter(({ item, start }) =>
        !isNaN(start.getTime()) && isToday(start) && !INACTIVE_STATUSES.has(String(item.status).toUpperCase()))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map(({ item, start }) => ({
        id: item.id,
        start,
        end: item.endTime
          ? new Date(item.endTime)
          : new Date(start.getTime() + (Number(item.duration) || 0) * 60000),
        barberName: names.get(item.employeeId) ?? null,
        statusLabel: STATUS_LABELS[String(item.status).toUpperCase()] ?? item.status
      }));
  }

  private toWorkday(name: string, schedule: ScheduleResponse | null): BarberWorkday {
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
}
