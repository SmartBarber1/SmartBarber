import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../../../../core/auth/services/session.service';
import { ReservationService } from '../../services/reservation.service';
import { ReservationHistoryItem } from '../../models/reservation.model';

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

// ID de barberia de respaldo mientras la sesion no lo exponga (TODO: quitar cuando exista en SessionService)
const DEFAULT_BARBERSHOP_ID = '55c1c44d-49ab-4267-b6f5-f6e78028b9f6';

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

  // EMPLOYEE -> reservas del barbero (/reservation-service/employee/{employeeId})
  // BARBER   -> todas las reservas de la barberia (/reservation-service/barber/{barbershopId})
  activeTab: BarberHistoryTab = 'EMPLOYEE';

  historyList: UnifiedReservationItem[] = [];
  isLoading = true;
  errorMessage = '';

  ngOnInit(): void {
    this.loadCombinedHistory();
  }

  selectTab(tab: BarberHistoryTab): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.loadCombinedHistory();
  }

  get tabTitle(): string {
    return this.activeTab === 'EMPLOYEE' ? 'Reservas del Barbero' : 'Reservas de la Barbería';
  }

  private get employeeId(): string | undefined {
    const s: any = this.sessionService.currentSession;
    return s?.employeeId ?? s?.userId;
  }

  private get barbershopId(): string {
    const s: any = this.sessionService.currentSession;
    return s?.barbershopId ?? DEFAULT_BARBERSHOP_ID;
  }

  async loadCombinedHistory(): Promise<void> {
    const isEmployee = this.activeTab === 'EMPLOYEE';
    const id = isEmployee ? this.employeeId : this.barbershopId;

    if (!id) {
      this.historyList = [];
      this.isLoading = false;
      this.errorMessage = 'No se encontró el identificador del barbero en la sesión actual.';
      this.cdr.markForCheck();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      const data = await firstValueFrom(
        this.reservationService.getReservationHistory(isEmployee ? 'employee' : 'barbershop', id)
      );

      this.historyList = (Array.isArray(data) ? data : [])
        .map(item => this.mapItem(item, this.activeTab))
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    } catch (err: any) {
      console.error('Error al sincronizar historiales:', err);
      this.historyList = [];

      if (err.status === 401) {
        this.errorMessage = 'Sesión no autorizada o token expirado. Inicia sesión nuevamente.';
      } else if (err.status === 404) {
        this.errorMessage = 'No se encontraron reservas para este registro.';
      } else if (err.status === 503) {
        this.errorMessage = 'El servicio de reservas no está disponible (503). Intenta de nuevo en unos momentos.';
      } else {
        this.errorMessage = 'No se pudo conectar con los servicios de reservas.';
      }
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  private mapItem(item: ReservationHistoryItem | any, source: BarberHistoryTab): UnifiedReservationItem {
    return {
      id: item.id,
      source,
      notes: item.notes || item.serviceName ||
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
    return this.historyList.filter(item => ['CONFIRMED', 'COMPLETED', 'APPROVED', 'ACTIVE'].includes(item.status)).length;
  }

  get totalMinutes(): number {
    return this.historyList.reduce((acc, item) => acc + (Number(item.duration) || 0), 0);
  }
}
