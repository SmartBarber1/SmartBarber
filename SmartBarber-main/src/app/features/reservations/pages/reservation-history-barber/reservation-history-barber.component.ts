import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../../../../core/auth/services/session.service';
import { ReservationService } from '../../services/reservation.service';
import { ReservationHistoryItem } from '../../models/reservation.model';
import { mensajeErrorReserva } from '../../utils/http-error.utils';

export type BarberHistoryTab = 'EMPLOYEE' | 'BARBER';

export interface UnifiedReservationItem {
  id: string;
  source: BarberHistoryTab;
  notes?: string;
  status: string;
  startTime: string;
  duration?: number;
  creationDate?: string;
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

  // EMPLOYEE -> reservas del barbero seleccionado (/reservation-service/employee/{employeeId})
  // BARBER   -> todas las reservas de la barbería de la sesión (/reservation-service/barber/{barbershopId})
  activeTab: BarberHistoryTab = 'EMPLOYEE';

  // La barbería se reconoce automáticamente desde la sesión
  barbershopId = '';

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
    this.barbershopId = this.resolveBarbershopId();

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

    if (this.barberos.length > 0) {
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
      notes:
        item.notes ||
        item.serviceName ||
        (source === 'EMPLOYEE' ? 'Servicio de Empleado' : 'Corte / Servicio Barbero'),
      status: item.status || 'PENDING',
      startTime: item.startTime || item.date || new Date().toISOString(),
      duration: item.duration || 0,
      creationDate: item.creationDate || item.createdAt || new Date().toISOString(),
      customerId: item.customerId,
      employeeId: item.employeeId
    };
  }

  get activeReservesCount(): number {
    return this.historyList.filter((item) =>
      ['CONFIRMED', 'COMPLETED', 'APPROVED', 'ACTIVE'].includes(item.status)
    ).length;
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
    return item.status === 'COMPLETED';
  }

  hasActions(item: UnifiedReservationItem): boolean {
    return this.canConfirm(item) || this.canCancel(item) || this.canRate(item);
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

    return (
      err?.error?.data?.message ||
      err?.error?.message ||
      mensajeErrorReserva(err)
    );
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