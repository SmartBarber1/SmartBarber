import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../../../../core/auth/services/session.service';
import { ReservationService } from '../../services/reservation.service';
import { ReservationHistoryItem } from '../../models/reservation.model';
import { mensajeErrorReserva } from '../../utils/http-error.utils';
import { toUserMessage } from '../../../../core/errors';
import { PenaltyApiService } from '../../../penalty/infrastructure/api/penalty-api.service';
import { DEFAULT_PENALTY_POLICY } from '../../../penalty/domain/models/penalty.model';

/** Plazo para que el administrador corrija una inasistencia (PEN-14). */
const NO_SHOW_CORRECTION_MS = 48 * 3_600_000;

export type BarberHistoryTab = 'EMPLOYEE' | 'BARBER';

/**
 * Calificar una reserva le corresponde al cliente (POST /reservation-review-service/
 * crear-resena-reserva); el barbero y el administrador no pueden hacerlo.
 */
const RATING_ENABLED = false;

const STATUS_LABELS: Readonly<Record<string, string>> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  IN_PROGRESS: 'En atención',
  COMPLETED: 'Finalizada',
  CANCELLED: 'Cancelada',
  WAITING: 'En espera',
  NO_SHOW: 'No asistió'
};

export interface UnifiedReservationItem {
  id: string;
  source: BarberHistoryTab;
  /** Servicios de la reserva, separados por coma. */
  services: string;
  /** Nota que dejó el cliente (vacía si no hay). */
  notes?: string;
  /** Origen de la reserva: RESERVATION o VIRTUAL_QUEUE. */
  reservationType?: string;
  status: string;
  startTime: string;
  duration?: number;
  creationDate?: string;
  /** Última modificación (para una inasistencia, cuándo se marcó). */
  updatedDate?: string;
  customerId?: string;
  employeeId?: string;
}

export interface SelectOption {
  id: string;
  name: string;
}

export interface SelectedEmployee {
  name: string;
  email?: string;
  phone?: string;
}

@Component({
  selector: 'app-reservation-history-barber',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reservation-history-barber.component.html',
  styleUrls: ['./reservation-history-barber.component.css']
})
export class ReservationHistoryBarberComponent implements OnInit {
  private readonly reservationService = inject(ReservationService);
  private readonly sessionService = inject(SessionService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly penaltyApi = inject(PenaltyApiService);

  // EMPLOYEE -> reservas del barbero seleccionado (/reservation-service/employee/{employeeId})
  // BARBER   -> todas las reservas de la barbería de la sesión (/reservation-service/barber/{barbershopId})
  activeTab: BarberHistoryTab = 'EMPLOYEE';

    // La barbería se reconoce automáticamente desde la sesión
  barbershopId = '';

  /** El barbero solo ve y gestiona sus propias reservas. */
  isBarber = false;
  /** Solo el administrador corrige inasistencias marcadas por error. */
  isAdmin = false;
  /** Minutos de tolerancia de la barbería antes de poder marcar "No asistió" (RF-82). */
  toleranceMinutes = DEFAULT_PENALTY_POLICY.toleranceMinutes;

  barberos: SelectOption[] = [];
  selectedEmployeeId = '';
  selectedEmployee: SelectedEmployee | null = null;

  historyList: UnifiedReservationItem[] = [];
  isLoading = true;
  errorMessage = '';

  // ---- Acciones (confirmar / cancelar / calificar) ----
  readonly stars = [1, 2, 3, 4, 5];
  feedback = '';
  busyId: string | null = null;
  ratingOpenId: string | null = null;

  private drafts: Record<string, { rating: number; comment: string }> = {};
  private rated = new Set<string>();

  ngOnInit(): void {
    this.init();
  }

  private resolveBarbershopId(): string {
    const session: any = this.sessionService.currentSession;
    return session?.barbershopId ?? '';
  }

  private async init(): Promise<void> {
    const session = this.sessionService.currentSession;
    this.isBarber = session?.role === 'BARBER';
    this.isAdmin = session?.role === 'ADMIN';
    this.barbershopId = this.resolveBarbershopId();

    if (this.barbershopId) {
      this.penaltyApi.policyOf(this.barbershopId).subscribe(policy => {
        this.toleranceMinutes = policy.toleranceMinutes;
        this.cdr.markForCheck();
      });
    }

    if (this.isBarber) {
      this.activeTab = 'EMPLOYEE';
      if (!session?.barberId) {
        this.historyList = [];
        this.isLoading = false;
        this.errorMessage = 'No se encontró el identificador del barbero en la sesión actual.';
        this.cdr.markForCheck();
        return;
      }
    }

    if (!this.barbershopId) {
      this.historyList = [];
      this.isLoading = false;
      this.errorMessage = 'No se encontró la barbería asociada a la sesión actual.';
      this.cdr.markForCheck();
      return;
    }

    await this.loadBarberos();
    await this.loadCombinedHistory();
  }

  // Barberos de la barbería de la sesión
  private async loadBarberos(): Promise<void> {
    this.barberos = [];
    this.selectedEmployeeId = '';
    this.selectedEmployee = null;

    try {
      const res: any = await firstValueFrom(
        this.reservationService.getEmployeesByBarberiaId(this.barbershopId)
      );
      const raw = res?.data ?? res;
      const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
      this.barberos = list.map((e: any) => ({
        id: e.id || e.id_empleado,
        name: e.name || e.nombre || 'Barbero'
      }));
    } catch (err) {
      console.error('Error al cargar barberos de la barbería:', err);
      this.barberos = [];
    }

    // El barbero siempre consulta sus propias reservas.
    const ownId = this.isBarber ? this.sessionService.currentSession?.barberId ?? '' : '';
    if (ownId) {
      this.selectedEmployeeId = ownId;
      await this.loadSelectedEmployee();
    } else if (this.barberos.length > 0) {
      this.selectedEmployeeId = this.barberos[0].id;
      await this.loadSelectedEmployee();
    }

    this.cdr.markForCheck();
  }

  // GET /employee-service/id/{id}: datos del barbero cuyas reservas se consultan
  private async loadSelectedEmployee(): Promise<void> {
    const id = this.selectedEmployeeId;
    this.selectedEmployee = null;
    if (!id) return;

    const fallback = this.barberos.find((b) => b.id === id);
    try {
      const res: any = await firstValueFrom(this.reservationService.getEmployeeById(id));
      const emp = res?.data ?? res;
      this.selectedEmployee = {
        name: emp?.name || emp?.nombre || fallback?.name || 'Barbero',
        email: emp?.email,
        phone: emp?.phone || emp?.telefono
      };
    } catch (err) {
      console.error('Error al cargar datos del barbero:', err);
      this.selectedEmployee = fallback ? { name: fallback.name } : null;
    }

    this.cdr.markForCheck();
  }

  selectTab(tab: BarberHistoryTab): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.feedback = '';
    this.ratingOpenId = null;
    this.loadCombinedHistory();
  }

  async onBarberoChange(id: string): Promise<void> {
    this.selectedEmployeeId = id;
    this.feedback = '';
    this.ratingOpenId = null;
    await this.loadSelectedEmployee();
    await this.loadCombinedHistory();
  }

  // Botones "Sincronizar" y "Reintentar"
  async reload(): Promise<void> {
    this.feedback = '';
    if (!this.barbershopId) {
      await this.init();
      return;
    }
    await this.loadCombinedHistory();
  }

  barberName(employeeId?: string): string {
    if (!employeeId) return '-';
    return this.barberos.find((b) => b.id === employeeId)?.name ?? `${employeeId.slice(0, 8)}…`;
  }

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  get tabTitle(): string {
    return this.activeTab === 'EMPLOYEE' ? 'Reservas del Barbero' : 'Reservas de la Barbería';
  }

  async loadCombinedHistory(preserveFeedback = false): Promise<void> {
    const isEmployee = this.activeTab === 'EMPLOYEE';
    const id = isEmployee ? this.selectedEmployeeId : this.barbershopId;

    this.errorMessage = '';
    if (!preserveFeedback) {
      this.feedback = '';
    }

    if (!id) {
      this.historyList = [];
      this.isLoading = false;
      this.cdr.markForCheck();
      return;
    }

    this.isLoading = true;
    this.cdr.markForCheck();

    try {
      const data = await firstValueFrom(
        this.reservationService.getReservationHistory(isEmployee ? 'employee' : 'barbershop', id)
      );

      this.historyList = (Array.isArray(data) ? data : [])
        .map((item) => this.mapItem(item, this.activeTab))
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    } catch (err: any) {
      console.error('Error al sincronizar historiales:', err);
      this.historyList = [];

      const apiMessage = err?.error?.data?.message || err?.error?.message;

      if (err?.status === 401) {
        this.errorMessage = 'Sesión no autorizada o token expirado. Inicia sesión nuevamente.';
      } else if (err?.status === 503) {
        this.errorMessage =
          'El servicio de reservas no está disponible (503). Intenta de nuevo en unos momentos.';
      } else {
        this.errorMessage = apiMessage || 'No se pudo conectar con los servicios de reservas.';
      }
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  private mapItem(
    item: ReservationHistoryItem | any,
    source: BarberHistoryTab
  ): UnifiedReservationItem {
    return {
      id: item.id,
      source,
      services:
        Array.isArray(item.services) && item.services.length > 0 ? item.services.join(', ') : 'Servicio',
      notes: typeof item.notes === 'string' && item.notes.trim() ? item.notes.trim() : undefined,
      reservationType: item.reservationType,
      status: item.status || 'PENDING',
      startTime: item.startTime || item.date || new Date().toISOString(),
      duration: item.duration || 0,
      creationDate: item.creationDate || item.createdAt || new Date().toISOString(),
      updatedDate: item.updatedDate || undefined,
      customerId: item.customerId,
      employeeId: item.employeeId
    };
  }

  /** Citas que siguen abiertas: pendientes, confirmadas o en atención y aún no vencidas. */
  get activeReservesCount(): number {
    const now = Date.now();
    return this.historyList.filter((item) => {
      if (item.status === 'IN_PROGRESS' || item.status === 'WAITING') return true;
      if (item.status !== 'PENDING' && item.status !== 'CONFIRMED') return false;
      const start = new Date(item.startTime).getTime();
      return Number.isNaN(start) || start >= now;
    }).length;
  }

  originLabel(item: UnifiedReservationItem): string {
    return item.reservationType === 'VIRTUAL_QUEUE' ? 'Cola virtual' : 'Reserva';
  }

  get totalMinutes(): number {
    return this.historyList.reduce((acc, item) => acc + (Number(item.duration) || 0), 0);
  }

  // =====================================================
  // ACCIONES POR FILA
  // =====================================================

  canConfirm(item: UnifiedReservationItem): boolean {
    return item.status === 'PENDING';
  }

  canCancel(item: UnifiedReservationItem): boolean {
    return ['PENDING', 'CONFIRMED'].includes(item.status);
  }

  canRate(item: UnifiedReservationItem): boolean {
    return RATING_ENABLED && item.status === 'COMPLETED';
  }

  /** La reserva ya llegó a su hora de inicio (el back valida lo mismo: RES_016). */
  private hasStarted(item: UnifiedReservationItem): boolean {
    const start = new Date(item.startTime).getTime();
    return !isNaN(start) && start <= Date.now();
  }

  /** Atendida: confirmada o en atención, y ya empezó. */
  canComplete(item: UnifiedReservationItem): boolean {
    return ['CONFIRMED', 'IN_PROGRESS'].includes(item.status) && this.hasStarted(item);
  }

  /**
   * El cliente no llegó (PEN-01): solo una cita agendada y confirmada, y una
   * vez pasada la hora de inicio más la tolerancia de la barbería.
   */
  canMarkNoShow(item: UnifiedReservationItem): boolean {
    const start = new Date(item.startTime).getTime();
    return item.status === 'CONFIRMED'
      && item.reservationType !== 'VIRTUAL_QUEUE'
      && !isNaN(start)
      && start + this.toleranceMinutes * 60_000 <= Date.now();
  }

  /** El administrador corrige un "No asistió" dentro de las 48 horas (PEN-14). */
  canRevertNoShow(item: UnifiedReservationItem): boolean {
    if (!this.isAdmin || item.status !== 'NO_SHOW') return false;
    const markedAt = new Date(item.updatedDate || item.startTime).getTime();
    return !isNaN(markedAt) && markedAt + NO_SHOW_CORRECTION_MS >= Date.now();
  }

  hasActions(item: UnifiedReservationItem): boolean {
    return this.canConfirm(item) || this.canCancel(item) || this.canComplete(item)
      || this.canMarkNoShow(item) || this.canRevertNoShow(item) || this.canRate(item);
  }

  async revertNoShow(item: UnifiedReservationItem): Promise<void> {
    const reason = window.prompt('Motivo de la corrección (obligatorio, entre 5 y 200 caracteres):')?.trim() ?? '';
    if (!reason) return;
    if (reason.length < 5 || reason.length > 200) {
      this.feedback = 'El motivo debe tener entre 5 y 200 caracteres.';
      this.cdr.markForCheck();
      return;
    }
    await this.runAction(
      item,
      () => this.penaltyApi.revertNoShow(item.id, reason),
      'CANCELLED',
      'Inasistencia corregida: ya no cuenta para el cliente y, si causó una restricción, esta se levantó.'
    );
  }

  async complete(item: UnifiedReservationItem): Promise<void> {
    await this.runAction(
      item,
      () => this.reservationService.completeReservation(item.id),
      'COMPLETED',
      'Reserva finalizada. El cliente ya puede calificar la atención.'
    );
  }

  async markNoShow(item: UnifiedReservationItem): Promise<void> {
    if (!window.confirm('¿Confirmas que el cliente no se presentó? Cuenta para la política de inasistencias de la barbería y se le avisará.')) return;
    await this.runAction(
      item,
      () => this.reservationService.markNoShow(item.id),
      'NO_SHOW',
      'Inasistencia registrada. El cliente recibió el aviso con su conteo.'
    );
  }

  async confirm(item: UnifiedReservationItem): Promise<void> {
    await this.runAction(
      item,
      () => this.reservationService.confirmReservation(item.id),
      'CONFIRMED',
      'Reserva confirmada.'
    );
  }

  async cancel(item: UnifiedReservationItem): Promise<void> {
    if (!window.confirm('¿Seguro que deseas cancelar esta reserva?')) return;
    await this.runAction(
      item,
      () => this.reservationService.cancelReservation(item.id),
      'CANCELLED',
      'Reserva cancelada.'
    );
  }

  // ---- Calificar ----
  draft(id: string) {
    return (this.drafts[id] ??= { rating: 0, comment: '' });
  }

  setRating(id: string, n: number): void {
    this.draft(id).rating = n;
  }

  setComment(id: string, value: string): void {
    this.draft(id).comment = value;
  }

  isRated(id: string): boolean {
    return this.rated.has(id);
  }

  toggleRate(item: UnifiedReservationItem): void {
    this.feedback = '';
    this.ratingOpenId = this.ratingOpenId === item.id ? null : item.id;
  }

  async submitRating(item: UnifiedReservationItem): Promise<void> {
    const d = this.draft(item.id);
    if (d.rating < 1) {
      this.feedback = 'Elige de 1 a 5 estrellas antes de enviar.';
      this.cdr.markForCheck();
      return;
    }

    this.busyId = item.id;
    this.feedback = '';
    this.cdr.markForCheck();

    try {
      await firstValueFrom(
        this.reservationService.rateReservation(item.id, {
          rating: d.rating,
          comment: d.comment.trim()
        })
      );
      this.rated.add(item.id);
      this.ratingOpenId = null;
      this.feedback = 'Calificación enviada.';
      await this.loadCombinedHistory(true);
    } catch (err: any) {
      this.feedback = this.actionErrorMessage(err);
    } finally {
      this.busyId = null;
      this.cdr.markForCheck();
    }
  }

  // Muestra el motivo real del backend y deja el detalle completo en consola
  private actionErrorMessage(err: any): string {
    console.error('Error en acción de reserva:', {
      status: err?.status,
      url: err?.url,
      body: err?.error,
      raw: err
    });

    // Mensajes del catálogo (en español), nunca el texto técnico del servidor.
    return toUserMessage(err, { DEFAULT: mensajeErrorReserva(err) });
  }

  private async runAction(
    item: UnifiedReservationItem,
    call: () => any,
    newStatus: string,
    okMessage: string
  ): Promise<void> {
    this.busyId = item.id;
    this.feedback = '';
    this.cdr.markForCheck();

    try {
      await firstValueFrom(call());
      item.status = newStatus;
      this.feedback = okMessage;
      this.cdr.markForCheck();
      await this.loadCombinedHistory(true);
    } catch (err: any) {
      this.feedback = this.actionErrorMessage(err);
    } finally {
      this.busyId = null;
      this.cdr.markForCheck();
    }
  }
}