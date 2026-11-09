import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { SessionService } from '../../../../core/auth/services/session.service';
import { FirebaseAuthService } from '../../../../core/auth/services/firebase-auth.service';
import { environment } from '../../../../../environments/environment';

export interface ReservationHistoryItem {
  id: string;
  barbershopId?: string;
  clientId?: string;
  employeeId?: string;
  serviceName?: string;
  status: string;
  reservationDate?: string;
  date?: string;
  price?: number;
  servicePrice?: number;
  createdAt: string;
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

  historyList: ReservationHistoryItem[] = [];
  isLoading = true;
  errorMessage = '';

  ngOnInit(): void {
    this.loadReservationHistory();
  }

  async loadReservationHistory(): Promise<void> {
    const session = this.sessionService.currentSession;
    const clientId = session?.clientId || session?.userId;

    if (!clientId) {
      this.isLoading = false;
      this.errorMessage = 'No se encontró el identificador del cliente en la sesión actual.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      const token = await this.firebaseAuthService.getIdToken();

      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      });

      const baseUrl = environment.apiUrl || 'http://localhost:8080';
      const endpoint = `${baseUrl}/reservations-service/client-history/${clientId}`;

      const data = await this.http.get<ReservationHistoryItem[]>(endpoint, { headers }).toPromise();
      
      this.historyList = data || [];
      this.errorMessage = '';

    } catch (err: any) {
      console.error('Error en el servicio de historial de reservas:', err);
      if (err.status === 503) {
        this.errorMessage = 'El servicio de reservas se encuentra temporalmente fuera de línea en Render (503). Intenta nuevamente en unos momentos.';
      } else if (err.status === 401) {
        this.errorMessage = 'Sesión no autorizada o token expirado. Inicia sesión nuevamente.';
      } else {
        this.errorMessage = 'No se pudo obtener el historial de reservas.';
      }
    } finally {
      this.isLoading = false;
    }
  }

  get activeReservesCount(): number {
    return this.historyList.filter(item => 
      item.status === 'ACTIVE' || 
      item.status === 'CONFIRMED' || 
      item.status === 'APPROVED'
    ).length;
  }

  get totalSpent(): number {
    return this.historyList.reduce((acc, item) => {
      const priceVal = Number(item.servicePrice ?? item.price ?? 0);
      return acc + priceVal;
    }, 0);
  }
}