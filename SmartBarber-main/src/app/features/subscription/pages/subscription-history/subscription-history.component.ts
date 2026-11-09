import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { SessionService } from '../../../../core/auth/services/session.service';
import { environment } from '../../../../../environments/environment';

export interface SubscriptionHistoryItem {
  id: string;
  subscriptionName?: string;
  status: string;
  startDate: string;
  expirationDate: string;
  price: number;
  createdAt: string;
}

@Component({
  selector: 'app-subscription-history',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './subscription-history.component.html',
  styleUrls: ['./subscription-history.component.css']
})
export class SubscriptionHistoryComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly sessionService = inject(SessionService);

  historyList: SubscriptionHistoryItem[] = [];
  isLoading = true;
  errorMessage = '';

  ngOnInit(): void {
    this.loadSubscriptionHistory();
  }

  loadSubscriptionHistory(): void {
    const session = this.sessionService.currentSession;
    const barbershopId = session?.barbershopId;

    if (!barbershopId) {
      this.isLoading = false;
      this.errorMessage = 'No se encontró el identificador de la barbería en la sesión actual.';
      return;
    }

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    });

    const baseUrl = environment.apiUrl || 'http://localhost:8080';
    const endpoint = `${baseUrl}/subscription-barbershop-service/subscription-history/${barbershopId}`;

    this.isLoading = true;
    this.errorMessage = '';

    this.http.get<SubscriptionHistoryItem[]>(endpoint, { headers }).subscribe({
      next: (data) => {
        this.historyList = data || [];
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error en el servicio de historial:', err);
        this.isLoading = false;
        if (err.status === 503) {
          this.errorMessage = 'El servicio de suscripciones se encuentra temporalmente fuera de línea en Render (503). Intenta nuevamente en unos momentos.';
        } else if (err.status === 401) {
          this.errorMessage = 'Sesión no autorizada o token expirado. Inicia sesión nuevamente.';
        } else {
          this.errorMessage = 'No se pudo obtener el historial de transacciones de la barbería.';
        }
      }
    });
  }

  get activeSubscriptionsCount(): number {
    return this.historyList.filter(item => item.status === 'ACTIVE' || item.status === 'APPROVED').length;
  }

  get totalSpent(): number {
    return this.historyList.reduce((acc, item) => acc + (Number(item.price) || 0), 0);
  }
}