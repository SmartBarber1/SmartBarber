import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, throwError } from 'rxjs';

import { SessionService } from '../../../core/auth/services/session.service';
import { environment } from '../../../../environments/environment';

import { UserFacingError } from '../../../core/errors';
export type SubscriptionType = 'CREATE' | 'RENEW';
export const SUBSCRIPTION_DURATION = 60;
export type SubscriptionBarberStatus =
  | 'ACTIVE'
  | 'APPROVED'
  | 'PENDING'
  | 'DECLINED'
  | 'EXPIRED'
  | 'REFUNDED'
  | 'NOT_SUBSCRIPTION'
  | 'CANCELED';

export interface SubscriptionPayload {
  subscriptionId: number;
  duration: number;
  automaticRenew: boolean;
}

export interface SubscriptionBarbershopRequest
  extends SubscriptionPayload {
  barberId: string;
  status: SubscriptionBarberStatus;
  type: SubscriptionType;
}

export interface SubscriptionCreationResponse {
  id: string;
  /** Solo lo devuelve POST /create. PUT /renew no incluye la referencia del pago. */
  barberId: string;
  subscriptionId: number;
  status: SubscriptionBarberStatus;
  duration: number;
  subscriptionPrice: number;
  subscriptionDiscount: number;
  orderId?: string | null;
  createdAt: string;
  updatedAt: string | null;
  startDate: string | null;
  expirationDate: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private readonly createUrl =
    `${environment.apiUrl}/subscription-barbershop-service/create`;
  private readonly renewUrl =
    `${environment.apiUrl}/subscription-barbershop-service/renew`;
  private readonly paymentStatusSubject =
    new Subject<unknown>();

  private socket: WebSocket | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly sessionService: SessionService
  ) {}

  createSubscription(
    payload: SubscriptionPayload
  ): Observable<SubscriptionCreationResponse> {
    const barberId = this.getAuthenticatedEmployeeId();

    return this.http.post<SubscriptionCreationResponse>(
      this.createUrl,
      this.toRequest(payload, barberId, 'CREATE')
    );
  }

  renewSubscription(
    payload: SubscriptionPayload
  ): Observable<SubscriptionCreationResponse> {
    const barberId = this.getAuthenticatedEmployeeId();

    return this.http.put<SubscriptionCreationResponse>(
      this.renewUrl,
      this.toRequest(payload, barberId, 'RENEW')
    );
  }

  getSubscriptionData(): Observable<never> {
    return throwError(
      () => new Error(
        'La consulta de suscripción vigente no está disponible: el contrato de ese endpoint aún no está confirmado.'
      )
    );
  }

  connectWebSocket(orderId: string | null | undefined): void {
    this.disconnectWebSocket();

    if (!orderId?.trim()) {
      throw new UserFacingError(
        'No recibimos la referencia del pago, así que no podemos mostrar su estado en tiempo real. Consulta el estado del plan en unos minutos.'
      );
    }

    const apiUrl = new URL(environment.apiUrl);
    const protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    const paymentUrl =
      `${protocol}//${apiUrl.host}/ws/payment?orderId=${encodeURIComponent(orderId)}`;

    const socket = new WebSocket(paymentUrl);
    this.socket = socket;

    socket.onopen = () => {
      console.info('Conectado al WebSocket de pagos.');
    };

    socket.onmessage = event => {
      try {
        this.paymentStatusSubject.next(JSON.parse(event.data) as unknown);
      } catch (error: unknown) {
        console.warn('El evento de pago no contiene JSON válido:', error);
        this.paymentStatusSubject.next(event.data);
      }
    };

    socket.onerror = error => {
      console.error('Error en el WebSocket de pagos:', error);
    };

    socket.onclose = event => {
      if (this.socket === socket) {
        this.socket = null;
      }

      console.info(
        `WebSocket de pagos cerrado (código ${event.code}).`
      );
    };
  }

  getPaymentStatus(): Observable<unknown> {
    return this.paymentStatusSubject.asObservable();
  }

  disconnectWebSocket(): void {
    const socket = this.socket;
    this.socket = null;

    if (
      socket &&
      (
        socket.readyState === WebSocket.CONNECTING ||
        socket.readyState === WebSocket.OPEN
      )
    ) {
      socket.close();
    }
  }

  private toRequest(
    payload: SubscriptionPayload,
    barberId: string,
    type: SubscriptionType
  ): SubscriptionBarbershopRequest {
    return {
      subscriptionId: payload.subscriptionId,
      duration: payload.duration,
      automaticRenew: payload.automaticRenew,
      barberId,
      status: 'PENDING',
      type
    };
  }

  private getAuthenticatedEmployeeId(): string {
    const session = this.sessionService.currentSession;

    if (
      session?.role !== 'ADMIN' ||
      !session.barberId ||
      !session.barbershopId
    ) {
      throw new UserFacingError(
        'No se encontró un perfil de administrador asociado a una barbería. Cierra sesión y vuelve a ingresar.'
      );
    }

    return session.barbershopId;
  }
}

export { SubscriptionService as SubscriptionWsService };
