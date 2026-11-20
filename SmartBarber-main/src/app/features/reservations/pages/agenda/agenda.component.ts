import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../../../../core/auth/services/session.service';
import { ReservationService } from '../../services/reservation.service';
import { ReservationHistoryItem } from '../../models/reservation.model';

export type AgendaView = 'PROXIMAS' | 'ANTERIORES';

export interface AgendaDay {
  key: string;          // yyyy-MM-dd
  date: Date;
  isToday: boolean;
  items: ReservationHistoryItem[];
}

const INACTIVE_STATUSES = ['CANCELLED', 'EXPIRED', 'DECLINED', 'COMPLETED'];

const STATUS_LABELS: Readonly<Record<string, string>> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  IN_PROGRESS: 'En atención',
  COMPLETED: 'Finalizada',
  CANCELLED: 'Cancelada',
  WAITING: 'En espera',
  NO_SHOW: 'No asistió'
};

@Component({
  selector: 'app-agenda',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './agenda.component.html',
  styleUrls: ['./agenda.component.css']
})
export class AgendaComponent implements OnInit {
  private readonly reservationService = inject(ReservationService);
  private readonly sessionService = inject(SessionService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly views: { key: AgendaView; label: string }[] = [
    { key: 'PROXIMAS', label: 'Próximas' },
    { key: 'ANTERIORES', label: 'Anteriores' }
  ];

  activeView: AgendaView = 'PROXIMAS';
  reservations: ReservationHistoryItem[] = [];
  isLoading = true;
  errorMessage = '';

  // Calculado una sola vez por carga para no recalcular en cada ciclo de detección
  upcomingDays: AgendaDay[] = [];
  pastDays: AgendaDay[] = [];

  /** El administrador ve la agenda de toda la barbería; el barbero, la suya. */
  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  get isAdmin(): boolean {
    return this.sessionService.currentSession?.role === 'ADMIN';
  }

  ngOnInit(): void {
    this.load();
  }

  /**
   * Barbero -> sus reservas (id_empleado)
   * Admin   -> reservas de toda la barbería (id_barberia)
   * No se usa userId como respaldo: el backend espera ids de empleado/barbería.
   */
  private get target(): { type: 'employee' | 'barbershop'; id: string | undefined } {
    const s: any = this.sessionService.currentSession;

    if (s?.role === 'ADMIN') {
      return { type: 'barbershop', id: s?.barbershopId };
    }
    // En la sesión el id del empleado se guarda como barberId.
    return { type: 'employee', id: s?.barberId ?? s?.employeeId };
  }

  setView(view: AgendaView): void {
    this.activeView = view;
  }

  get days(): AgendaDay[] {
    return this.activeView === 'PROXIMAS' ? this.upcomingDays : this.pastDays;
  }

  countFor(view: AgendaView): number {
    const days = view === 'PROXIMAS' ? this.upcomingDays : this.pastDays;
    return days.reduce((acc, d) => acc + d.items.length, 0);
  }

  async load(): Promise<void> {
    const { type, id } = this.target;

    if (!id) {
      this.isLoading = false;
      this.errorMessage = type === 'employee'
        ? 'No se encontró el identificador del barbero en la sesión actual.'
        : 'No se encontró la barbería asociada a la sesión actual.';
      this.cdr.markForCheck();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      const data = await firstValueFrom(this.reservationService.getReservationHistory(type, id));
      this.reservations = Array.isArray(data) ? data : [];
      this.buildDays();
    } catch (err: any) {
      console.error('Error cargando la agenda:', err);
      this.reservations = [];
      this.upcomingDays = [];
      this.pastDays = [];

      const apiMessage = err?.error?.data?.message || err?.error?.message;
      this.errorMessage =
        err?.status === 401 ? 'Sesión no autorizada o token expirado. Inicia sesión nuevamente.'
        : err?.status === 404 ? 'No se encontraron reservas para esta agenda.'
        : err?.status === 503 ? 'El servicio de reservas no está disponible (503). Intenta de nuevo en unos momentos.'
        : apiMessage || 'No se pudo cargar la agenda.';
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  private buildDays(): void {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayKey = this.dayKey(startOfToday);

    const upcoming = this.reservations.filter(r =>
      new Date(r.startTime).getTime() >= startOfToday.getTime() && !INACTIVE_STATUSES.includes(r.status)
    );
    const past = this.reservations.filter(r => !upcoming.includes(r));

    // Próximas: de la más cercana a la más lejana. Anteriores: de la más reciente hacia atrás.
    this.upcomingDays = this.groupByDay(upcoming, 'asc', todayKey);
    this.pastDays = this.groupByDay(past, 'desc', todayKey);
  }

  private groupByDay(items: ReservationHistoryItem[], order: 'asc' | 'desc', todayKey: string): AgendaDay[] {
    const sorted = [...items].sort((a, b) => {
      const diff = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      return order === 'asc' ? diff : -diff;
    });

    const map = new Map<string, AgendaDay>();
    for (const item of sorted) {
      const date = new Date(item.startTime);
      const key = this.dayKey(date);
      if (!map.has(key)) {
        map.set(key, { key, date, isToday: key === todayKey, items: [] });
      }
      map.get(key)!.items.push(item);
    }
    return Array.from(map.values());
  }

  private dayKey(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  endTime(item: ReservationHistoryItem): Date {
    return new Date(new Date(item.startTime).getTime() + (Number(item.duration) || 0) * 60000);
  }

  statusClass(status: string): string {
    if (['CONFIRMED', 'COMPLETED', 'APPROVED', 'ACTIVE'].includes(status)) return 'chip-ok';
    if (status === 'PENDING') return 'chip-wait';
    if (['CANCELLED', 'EXPIRED', 'DECLINED'].includes(status)) return 'chip-bad';
    return '';
  }
}