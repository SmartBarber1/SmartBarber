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

export interface SelectOption {
  id: string;
  name: string;
}

export interface SelectedEmployee {
  name: string;
  email?: string;
  phone?: string;
}

// ID de barberia de respaldo si la lista de barberias no carga y la sesion no lo trae
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

  // EMPLOYEE -> reservas del barbero seleccionado (/reservation-service/employee/{employeeId})
  // BARBER   -> todas las reservas de la barberia (/reservation-service/barber/{barbershopId})
  activeTab: BarberHistoryTab = 'EMPLOYEE';

  barberias: SelectOption[] = [];
  barberos: SelectOption[] = [];
  selectedBarberiaId = '';
  selectedEmployeeId = '';
  selectedEmployee: SelectedEmployee | null = null;

  historyList: UnifiedReservationItem[] = [];
  isLoading = true;
  errorMessage = '';

  ngOnInit(): void {
    this.init();
  }

  private async init(): Promise<void> {
    this.isLoading = true;
    this.cdr.markForCheck();

    try {
      const res: any = await firstValueFrom(this.reservationService.getBarberias());
      const raw = res?.data ?? res;
      const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
      this.barberias = list.map((b: any) => ({
        id: b.id || b.id_barberia,
        name: b.location ? `${b.name} - ${b.location}` : (b.name || b.nombre || 'Barbería')
      }));
    } catch (err) {
      console.error('Error al cargar barberías:', err);
      this.barberias = [];
    }

    this.selectedBarberiaId = this.pickDefaultBarberiaId();
    await this.loadBarberos();
    await this.loadCombinedHistory();
  }

  private pickDefaultBarberiaId(): string {
    const s: any = this.sessionService.currentSession;
    const ids = this.barberias.map(b => b.id);
    const preferred = [s?.barbershopId, DEFAULT_BARBERSHOP_ID].find(id => id && ids.includes(id));
    return preferred ?? ids[0] ?? s?.barbershopId ?? DEFAULT_BARBERSHOP_ID;
  }

  private async loadBarberos(): Promise<void> {
    this.barberos = [];
    this.selectedEmployeeId = '';
    this.selectedEmployee = null;

    if (!this.selectedBarberiaId) return;

    try {
      const res: any = await firstValueFrom(
        this.reservationService.getEmployeesByBarberiaId(this.selectedBarberiaId)
      );
      const raw = res?.data ?? res;
      const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
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

    const fallback = this.barberos.find(b => b.id === id);
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
    this.loadCombinedHistory();
  }

  async onBarberiaChange(id: string): Promise<void> {
    this.selectedBarberiaId = id;
    await this.loadBarberos();
    await this.loadCombinedHistory();
  }

  async onBarberoChange(id: string): Promise<void> {
    this.selectedEmployeeId = id;
    await this.loadSelectedEmployee();
    await this.loadCombinedHistory();
  }

  barberName(employeeId?: string): string {
    if (!employeeId) return '-';
    return this.barberos.find(b => b.id === employeeId)?.name ?? `${employeeId.slice(0, 8)}…`;
  }

  get tabTitle(): string {
    return this.activeTab === 'EMPLOYEE' ? 'Reservas del Barbero' : 'Reservas de la Barbería';
  }

  async loadCombinedHistory(): Promise<void> {
    const isEmployee = this.activeTab === 'EMPLOYEE';
    const id = isEmployee ? this.selectedEmployeeId : this.selectedBarberiaId;

    this.errorMessage = '';

    if (!id) {
      // Sin barbero/barbería seleccionados: se muestra el estado vacío
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
        .map(item => this.mapItem(item, this.activeTab))
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    } catch (err: any) {
      console.error('Error al sincronizar historiales:', err);
      this.historyList = [];

      const apiMessage = err?.error?.data?.message || err?.error?.message;

      if (err.status === 401) {
        this.errorMessage = 'Sesión no autorizada o token expirado. Inicia sesión nuevamente.';
      } else if (err.status === 503) {
        this.errorMessage = 'El servicio de reservas no está disponible (503). Intenta de nuevo en unos momentos.';
      } else {
        this.errorMessage = apiMessage || 'No se pudo conectar con los servicios de reservas.';
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