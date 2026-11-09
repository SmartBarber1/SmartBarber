import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../../../../core/auth/services/session.service';
import { FirebaseAuthService } from '../../../../core/auth/services/firebase-auth.service';
import { environment } from '../../../../../environments/environment';

export interface SubscriptionHistoryItem {
  id: string;
  barbershopId?: string;
  barberId?: string; // el backend devuelve este nombre
  subscriptionId?: number;
  status: string;
  duration?: number;
  price?: number;
  subscriptionPrice?: number;
  subscriptionDiscount?: number;
  startDate: string;
  expirationDate: string;
  createdAt: string;
  updatedAt?: string;
}

@Component({
  selector: 'app-subscription-history',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './subscription-history.component.html',
  styleUrls: ['./subscription-history.component.css']
})
export class SubscriptionHistoryComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly sessionService = inject(SessionService);
  private readonly firebaseAuthService = inject(FirebaseAuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  private destroyed = false;

  historyList: SubscriptionHistoryItem[] = [];
  isLoading = true;
  errorMessage = '';

  ngOnInit(): void {
    this.loadSubscriptionHistory();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
  }

  async loadSubscriptionHistory(): Promise<void> {
    const session = this.sessionService.currentSession;
    const barbershopId = session?.barbershopId;

    if (!barbershopId) {
      this.isLoading = false;
      this.errorMessage = 'No se encontró el identificador de la barbería en la sesión actual.';
      this.refreshView();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      // Token fresco desde tu servicio de Firebase
      const token = await this.firebaseAuthService.getIdToken();

      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      });

      const baseUrl = environment.apiUrl || 'http://localhost:8080';
      const endpoint = `${baseUrl}/subscription-barbershop-service/subscription-history/${barbershopId}`;

      // firstValueFrom reemplaza al toPromise() (deprecado)
      const data = await firstValueFrom(
        this.http.get<any[]>(endpoint, { headers })
      );

      this.historyList = Array.isArray(data) ? data.map(item => this.normalizeItem(item)) : [];
      this.errorMessage = '';
    } catch (err: any) {
      console.error('Error en el servicio de historial:', err);
      this.historyList = [];
      if (err?.status === 503) {
        this.errorMessage = 'El servicio de suscripciones se encuentra temporalmente fuera de línea en Render (503). Intenta nuevamente en unos momentos.';
      } else if (err?.status === 401) {
        this.errorMessage = 'Sesión no autorizada o token expirado. Inicia sesión nuevamente.';
      } else {
        this.errorMessage = 'No se pudo obtener el historial de transacciones de la barbería.';
      }
    } finally {
      // Siempre se quita el loader y se fuerza el repintado de la vista
      this.isLoading = false;
      this.refreshView();
    }
  }

  get activeSubscriptionsCount(): number {
    return this.historyList.filter(item => item.status === 'ACTIVE' || item.status === 'APPROVED').length;
  }

  get totalSpent(): number {
    return this.historyList.reduce((acc, item) => {
      const priceVal = Number(item.subscriptionPrice ?? item.price ?? 0);
      return acc + (isNaN(priceVal) ? 0 : priceVal);
    }, 0);
  }

  /** Repinta la vista de forma segura (necesario si la app corre sin zone.js). */
  private refreshView(): void {
    if (this.destroyed) return;
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  /**
   * Deja cada registro en el formato que espera el HTML:
   * - id siempre como string (para el pipe slice)
   * - price toma subscriptionPrice si price no viene
   * - fechas en formato válido para el pipe date (soporta arrays tipo Java LocalDateTime)
   */
  private normalizeItem(raw: any): SubscriptionHistoryItem {
    return {
      ...raw,
      id: String(raw?.id ?? ''),
      status: String(raw?.status ?? '').toUpperCase(),
      price: Number(raw?.price ?? raw?.subscriptionPrice ?? 0),
      startDate: this.normalizeDate(raw?.startDate),
      expirationDate: this.normalizeDate(raw?.expirationDate),
      createdAt: this.normalizeDate(raw?.createdAt)
    };
  }

  private normalizeDate(value: any): string {
    if (!value) return '';

    // Formato Java: [2026, 10, 21, 12, 0, 0]
    if (Array.isArray(value)) {
      const [y, m = 1, d = 1, h = 0, mi = 0, s = 0] = value;
      const date = new Date(y, m - 1, d, h, mi, s);
      return isNaN(date.getTime()) ? '' : date.toISOString();
    }

    // Timestamp numérico
    if (typeof value === 'number') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? '' : date.toISOString();
    }

    // String ISO u otro formato que el pipe date ya entiende
    return String(value);
  }
}