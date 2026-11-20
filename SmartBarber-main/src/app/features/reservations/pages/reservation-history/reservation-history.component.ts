import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../../../../core/auth/services/session.service';
import { ReservationService } from '../../services/reservation.service';
import { HistoryScope, ReservationHistoryItem } from '../../models/reservation.model';
import { toApiError, toUserMessage } from '../../../../core/errors';

const STATUS_LABELS: Readonly<Record<string, string>> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  IN_PROGRESS: 'En atención',
  COMPLETED: 'Finalizada',
  CANCELLED: 'Cancelada',
  WAITING: 'En espera',
  NO_SHOW: 'No asistió'
};

/** Máximo de caracteres del comentario de la reseña. */
const COMMENT_MAX = 300;

@Component({
  selector: 'app-reservation-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reservation-history.component.html',
  styleUrls: ['./reservation-history.component.css']
})
export class ReservationHistoryComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly reservationService = inject(ReservationService);
  private readonly sessionService = inject(SessionService);
  private readonly cdr = inject(ChangeDetectorRef);

  scope: HistoryScope = 'customer';
  historyList: ReservationHistoryItem[] = [];
  isLoading = true;
  errorMessage = '';

  // ---- Acciones del cliente: cancelar y calificar ----
  readonly stars = [1, 2, 3, 4, 5];
  readonly commentMax = COMMENT_MAX;
  feedback = '';
  busyId: string | null = null;
  ratingOpenId: string | null = null;
  ratingError = '';
  private readonly drafts: Record<string, { rating: number; comment: string }> = {};
  /** Reservas ya calificadas en esta sesión (o que el servidor indicó como calificadas). */
  private readonly rated = new Set<string>();

  ngOnInit(): void {
    this.scope = this.route.snapshot.data['scope'] ?? 'customer';
    this.loadReservationHistory();
  }

  get headerTag(): string {
    return {
      customer: '✦ PANEL DE CLIENTE',
      employee: '✦ PANEL DE BARBERO',
      barbershop: '✦ PANEL DE BARBERÍA'
    }[this.scope];
  }

  get subtitle(): string {
    return {
      customer: 'Consulta y seguimiento detallado de tus servicios y citas agendadas.',
      employee: 'Citas que has atendido y que tienes programadas.',
      barbershop: 'Todas las reservas registradas en tu barbería.'
    }[this.scope];
  }

  // TODO: confirmar los nombres reales en SessionService.currentSession
  private resolveId(): string | undefined {
    const s: any = this.sessionService.currentSession;
    return {
      customer: s?.clientId,
      employee: s?.barberId ?? s?.employeeId,
      barbershop: s?.barbershopId
    }[this.scope];
  }

  async loadReservationHistory(): Promise<void> {
    const id = this.resolveId();

    if (!id) {
      this.isLoading = false;
      this.errorMessage = 'No se encontró el identificador en la sesión actual.';
      this.cdr.markForCheck();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      const data = await firstValueFrom(
        this.reservationService.getReservationHistory(this.scope, id)
      );

      this.historyList = (data ?? []).sort(
        (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
    } catch (err: any) {
      console.error('Error cargando historial de reservas:', err);

      if (err.status === 401) {
        this.errorMessage = 'Sesión no autorizada o token expirado. Inicia sesión nuevamente.';
      } else if (err.status === 404) {
        this.errorMessage = 'No se encontró historial de reservas.';
      } else if (err.status === 503) {
        this.errorMessage = 'El servicio de reservas no está disponible (503). Intenta de nuevo en unos momentos.';
      } else {
        this.errorMessage = 'No se pudo obtener el historial de reservas.';
      }
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  get activeReservesCount(): number {
    return this.historyList.filter(item =>
      ['PENDING', 'CONFIRMED', 'ACTIVE', 'APPROVED'].includes(item.status)
    ).length;
  }

  get totalMinutes(): number {
    return this.historyList
      .filter(item => item.status === 'COMPLETED')
      .reduce((acc, item) => acc + (item.duration ?? 0), 0);
  }

    /** Servicios reservados (los envía el back); si no vienen, la nota o "Servicio". */
  serviceText(item: ReservationHistoryItem): string {
    return item.services?.length ? item.services.join(', ') : (item.notes || 'Servicio');
  }

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  get isCustomer(): boolean {
    return this.scope === 'customer';
  }

  /** El cliente puede cancelar mientras la cita no haya empezado. */
  canCancel(item: ReservationHistoryItem): boolean {
    const start = new Date(item.startTime).getTime();
    return this.isCustomer
      && ['PENDING', 'CONFIRMED'].includes(item.status)
      && (isNaN(start) || start > Date.now());
  }

  /** Solo se califican las reservas finalizadas, una vez. */
  canRate(item: ReservationHistoryItem): boolean {
    return this.isCustomer && item.status === 'COMPLETED' && !this.rated.has(item.id);
  }

  isRated(item: ReservationHistoryItem): boolean {
    return this.rated.has(item.id);
  }

  draft(id: string): { rating: number; comment: string } {
    return (this.drafts[id] ??= { rating: 0, comment: '' });
  }

  setRating(id: string, rating: number): void {
    this.draft(id).rating = rating;
    this.ratingError = '';
  }

  setComment(id: string, value: string): void {
    this.draft(id).comment = value.slice(0, COMMENT_MAX);
  }

  toggleRate(item: ReservationHistoryItem): void {
    this.feedback = '';
    this.ratingError = '';
    this.ratingOpenId = this.ratingOpenId === item.id ? null : item.id;
  }

  async cancel(item: ReservationHistoryItem): Promise<void> {
    if (!window.confirm('¿Seguro que deseas cancelar esta reserva?')) return;

    this.busyId = item.id;
    this.feedback = '';
    this.cdr.markForCheck();

    try {
      await firstValueFrom(this.reservationService.cancelReservation(item.id));
      this.feedback = 'Reserva cancelada.';
      await this.loadReservationHistory();
    } catch (err: unknown) {
      this.feedback = toUserMessage(err, { DEFAULT: 'No fue posible cancelar la reserva.' });
    } finally {
      this.busyId = null;
      this.cdr.markForCheck();
    }
  }

  async submitRating(item: ReservationHistoryItem): Promise<void> {
    const draft = this.draft(item.id);
    const comment = draft.comment.trim();

    if (draft.rating < 1 || !comment) {
      this.ratingError = 'Elige de 1 a 5 estrellas y escribe un comentario.';
      this.cdr.markForCheck();
      return;
    }

    this.busyId = item.id;
    this.ratingError = '';
    this.cdr.markForCheck();

    try {
      await firstValueFrom(this.reservationService.rateReservation(item.id, { rating: draft.rating, comment }));
      this.rated.add(item.id);
      this.ratingOpenId = null;
      this.feedback = '¡Gracias! Tu calificación quedó registrada.';
    } catch (err: unknown) {
      const message = toUserMessage(err, { DEFAULT: 'No fue posible registrar tu calificación.' });
      // RW_002: la reserva ya tenía una reseña; se marca como calificada.
      if (toApiError(err).code === 'RW_002') {
        this.rated.add(item.id);
        this.ratingOpenId = null;
      }
      this.ratingError = message;
    } finally {
      this.busyId = null;
      this.cdr.markForCheck();
    }
  }
}
