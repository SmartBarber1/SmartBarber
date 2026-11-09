import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { SessionService } from '../../../../../core/auth/services/session.service';
import { FirebaseAuthService } from '../../../../../core/auth/services/firebase-auth.service';
import { environment } from '../../../../../../environments/environment';

export interface ClientBarberHistoryItem {
  id: string;
  name: string;
  email?: string;
  role: 'CLIENT' | 'BARBER';
  actionPerformed: string;
  status: string;
  createdAt: string;
}

@Component({
  selector: 'app-client-barber-history',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './client-barber-history.component.html',
  styleUrls: ['./client-barber-history.component.css']
})
export class ClientBarberHistoryComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly sessionService = inject(SessionService);
  private readonly firebaseAuthService = inject(FirebaseAuthService);

  historyList: ClientBarberHistoryItem[] = [];
  isLoading = true;
  errorMessage = '';

  ngOnInit(): void {
    this.loadHistory();
  }

  async loadHistory(): Promise<void> {
    const session = this.sessionService.currentSession;
    const barbershopId = session?.barbershopId;

    if (!barbershopId) {
      this.isLoading = false;
      this.errorMessage = 'No se encontró el identificador de la barbería en la sesión actual.';
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
      const endpoint = `${baseUrl}/barbershop-users-service/history/${barbershopId}`;

      const data = await this.http.get<ClientBarberHistoryItem[]>(endpoint, { headers }).toPromise();
      this.historyList = data || [];
    } catch (err: any) {
      console.error('Error al obtener el historial de clientes y barberos:', err);
      if (err.status === 503) {
        this.errorMessage = 'El servicio se encuentra temporalmente fuera de línea (503).';
      } else if (err.status === 401) {
        this.errorMessage = 'Sesión no autorizada o token expirado. Inicia sesión nuevamente.';
      } else {
        this.errorMessage = 'No se pudo obtener el historial de clientes y barberos.';
      }
    } finally {
      this.isLoading = false;
    }
  }

  get totalClients(): number {
    return this.historyList.filter(item => item.role === 'CLIENT').length;
  }

  get totalBarbers(): number {
    return this.historyList.filter(item => item.role === 'BARBER').length;
  }
}