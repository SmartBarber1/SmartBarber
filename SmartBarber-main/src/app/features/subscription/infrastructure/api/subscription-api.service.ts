import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { SubscriptionRepository } from '../../domain/repositories/subscription.repository';
import { SubscriptionCatalogPlan } from '../../domain/models/subscription-catalog.model';

import { CurrentSubscription } from '../../domain/models/current-subscription.model';

import {
  ChangePlanRequest,
  ChangePlanResponse
} from '../../domain/models/change-plan.model';

import { SubscriptionPlan } from '../../domain/models/subscription-plan.model';
import { SubscriptionBarberStatus } from '../subscription-ws.service';

import {
  CancelSubscriptionRequest,
  CancelSubscriptionResponse
} from '../../domain/models/cancel-subscription.model';

import { RenewSubscriptionRequest, RenewSubscriptionResponse } from '../../domain/models/renew-subscription.model';

export class SubscriptionStatusContractUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubscriptionStatusContractUnavailableError';
  }
}

export interface ActualBarbershopSubscription {
  id: string;
  barberId: string;
  subscriptionId: number;
  status: SubscriptionBarberStatus;
  duration: number;
  subscriptionPrice: number;
  subscriptionDiscount: number;
  orderId: string;
  createdAt: string;
  updatedAt: string | null;
  startDate: string | null;
  expirationDate: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class SubscriptionApiService extends SubscriptionRepository {
  private readonly http = inject(HttpClient);

  getSubscriptionCatalog(): Observable<SubscriptionCatalogPlan[]> {
    return this.http.get<SubscriptionCatalogPlan[]>(
      `${environment.apiUrl}/subscription-service/all`
    );
  }

  getActualBarbershopSubscription(
    barbershopId: string
  ): Observable<ActualBarbershopSubscription> {
    const id = barbershopId.trim();

    if (!id) {
      return throwError(
        () => new Error('Se requiere el ID de la barbería para consultar la suscripción actual.')
      );
    }

    return this.http.get<ActualBarbershopSubscription>(
      `${environment.apiUrl}/subscription-barbershop-service/actual-subscription/${encodeURIComponent(id)}`
    );
  }

  private readonly unsupported = {
    current: 'La consulta heredada espera un modelo distinto al DTO de GET /subscription-barbershop-service/actual-subscription/{barberId}. Usa getActualBarbershopSubscription con el ID de la barbería.',
    plans: 'El catálogo del backend usa un DTO distinto al que espera el cliente legado de suscripciones.',
    change: 'El backend actual no documenta una operación para cambiar el plan de una suscripción.',
    cancel: 'El backend actual no documenta una operación para cancelar una suscripción.',
    renew: 'La renovación usa SubscriptionBarbershopRqDto y PUT /subscription-barbershop-service/renew. Utiliza SubscriptionWsService para enviar el contrato respaldado por backend.'
  };

  override getCurrentSubscription():
    Observable<CurrentSubscription> {
    return throwError(() =>
      new SubscriptionStatusContractUnavailableError(this.unsupported.current)
    );
  }

  override getAvailablePlans():
    Observable<SubscriptionPlan[]> {
    return throwError(() => new Error(this.unsupported.plans));
  }

  override changePlan(
    _request: ChangePlanRequest
  ): Observable<ChangePlanResponse> {
    return throwError(() => new Error(this.unsupported.change));
  }

  override cancelSubscription(
    _request: CancelSubscriptionRequest
  ): Observable<CancelSubscriptionResponse> {
    return throwError(() => new Error(this.unsupported.cancel));
  }

  override renewSubscription(
    _request: RenewSubscriptionRequest
  ): Observable<RenewSubscriptionResponse> {
    return throwError(() => new Error(this.unsupported.renew));
  }
}