import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../../../../core/auth/services/session.service';
import { FirebaseAuthService } from '../../../../core/auth/services/firebase-auth.service';
import { environment } from '../../../../../environments/environment';

export interface ReservationHistoryItem {
  id: string;
  barbershopId: string;
  customerId: string;
  employeeId: string;
  status: string;
  reservationType: string;
  notes?: string;
  duration: number;
  startTime: string;
  endTime: string;
  queueEntryTime?: string | null;
  creationDate: string;
  updatedDate: string;
}

@Component({
  selector: 'app-reservation-history',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './reservation-history.component.html',
  styleUrls: ['./reservation-history.component.css']
})
export class ReservationHistoryComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly sessionService = inject(SessionService);
  private readonly firebaseAuthService = inject(FirebaseAuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  historyList: ReservationHistoryItem[] = [];
  isLoading = true;
  errorMessage = '';

  ngOnInit(): void {
    this.loadReservationHistory();
  }

  async loadReservationHistory(): Promise<void> {
    const customerId = this.sessionService.currentSession?.clientId;

    if (!customerId) {
      this.isLoading = false;
      this.errorMessage = 'No se encontró el identificador del cliente en la sesión actual.';
      this.cdr.markForCheck();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      const token = await this.firebaseAuthService.getIdToken();

      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      });

      const baseUrl = environment.apiUrl || 'http://localhost:8080';
      const endpoint = `${baseUrl}/reservation-service/customer/${customerId}`;

      const data = await firstValueFrom(
        this.http.get<ReservationHistoryItem[]>(endpoint, { headers })
      );

      this.historyList = (data ?? []).sort(
        (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
    } catch (err: any) {
      console.error('Error cargando historial de reservas:', err);

      if (err.status === 401) {
        this.errorMessage = 'Sesión no autorizada o token expirado. Inicia sesión nuevamente.';
      } else if (err.status === 404) {
        this.errorMessage = 'No se encontró historial para este cliente.';
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
}