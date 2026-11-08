import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, Subscription, finalize, forkJoin } from 'rxjs';

import { SessionService } from '../../../../core/auth/services/session.service';
import { BarbershopSubscriptionAccessService } from '../../application/services/barbershop-subscription-access.service';
import { BarberShopResponse } from '../../../barber-shop/domain/models/barber-shop.model';
import { BarberShopApiService } from '../../../barber-shop/infrastructure/services/barber-shop-api.service';
import { SubscriptionCatalogPlan } from '../../domain/models/subscription-catalog.model';
import { SubscriptionApiService } from '../../infrastructure/api/subscription-api.service';
import {
  SubscriptionCreationResponse,
  SUBSCRIPTION_DURATION,
  SubscriptionWsService
} from '../../infrastructure/subscription-ws.service';

import { toUserMessage } from '../../../../core/errors';
import { paymentUpdateMessage, subscriptionStatusLabel } from '../../domain/models/status-labels';
@Component({
  selector: 'app-renewal-catalog',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './renewal-catalog.component.html',
  styleUrl: './renewal-catalog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RenewalCatalogComponent implements OnInit, OnDestroy {
  private readonly sessionService = inject(SessionService);
  private readonly barberShopApi = inject(BarberShopApiService);
  private readonly subscriptionApi = inject(SubscriptionApiService);
  private readonly subscriptionAccess = inject(BarbershopSubscriptionAccessService);
  private readonly subscriptionWs = inject(SubscriptionWsService);
  private paymentSubscription?: Subscription;

  readonly barberShop = signal<BarberShopResponse | null>(null);
  readonly plans = signal<SubscriptionCatalogPlan[]>([]);
  readonly loading = signal(false);
  readonly submittingPlanId = signal<number | null>(null);
  readonly errorMessage = signal('');
  readonly paymentMessage = signal('');
  readonly createdSubscription = signal<SubscriptionCreationResponse | null>(null);
  readonly subscriptionStatus = this.subscriptionAccess.state;

  ngOnDestroy(): void {
    this.paymentSubscription?.unsubscribe();
    this.subscriptionWs.disconnectWebSocket();
  }

  ngOnInit(): void {
    this.loadRenewalInformation();
  }

  reload(): void {
    this.loadRenewalInformation();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(value);
  }

  canRenew(): boolean {
    return ['active', 'expired', 'declined', 'refunded']
      .includes(this.subscriptionStatus().status);
  }

  renew(plan: SubscriptionCatalogPlan): void {
    if (this.submittingPlanId() !== null || !this.canRenew()) {
      return;
    }

    this.errorMessage.set('');
    this.paymentMessage.set('');
    this.createdSubscription.set(null);
    this.submittingPlanId.set(plan.id);

    let request: Observable<SubscriptionCreationResponse>;
    try {
      request = this.subscriptionWs.renewSubscription({
        subscriptionId: plan.id,
        duration: SUBSCRIPTION_DURATION,
        automaticRenew: false
      });
    } catch (error: unknown) {
      this.submittingPlanId.set(null);
      this.errorMessage.set(
        toUserMessage(error, {
          DEFAULT: 'No fue posible validar la barbería para iniciar la renovación.'
        })
      );
      return;
    }

    request.subscribe({
      next: response => {
        this.submittingPlanId.set(null);
        this.createdSubscription.set(response);
        this.listenForPayment(response);
      },
      error: (error: unknown) => {
        this.submittingPlanId.set(null);
        console.error('No fue posible iniciar la renovación:', error);
        this.errorMessage.set(
          toUserMessage(error, {
            SB_005: 'Ya tienes una renovación pendiente de pago o aprobada. Espera a que se confirme antes de solicitar otra.',
            VALIDATION: 'Los datos de la renovación no son válidos. Recarga la página e inténtalo de nuevo.',
            DEFAULT: 'No fue posible iniciar la renovación. Verifica el estado del plan e inténtalo nuevamente.'
          })
        );
      }
    });
  }

  private loadRenewalInformation(): void {
    const session = this.sessionService.currentSession;

    this.errorMessage.set('');
    this.plans.set([]);

    if (
      !session ||
      session.role !== 'ADMIN' ||
      !session.barberId ||
      !session.barbershopId
    ) {
      this.loading.set(false);
      this.errorMessage.set(
        'No encontramos una barbería asociada a tu perfil. Cierra sesión y vuelve a ingresar; si el problema continúa, contacta al administrador.'
      );
      return;
    }

    this.loading.set(true);

    forkJoin({
      barberShop: this.barberShopApi.getById(session.barbershopId),
      plans: this.subscriptionApi.getSubscriptionCatalog()
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: result => {
          if (
            !result.barberShop?.id ||
            result.barberShop.id !== session.barbershopId
          ) {
            this.errorMessage.set(
              'La barbería recibida no coincide con la asociada al perfil autenticado.'
            );
            return;
          }

          this.barberShop.set(result.barberShop);
          this.plans.set(result.plans);
        },
        error: (error: unknown) => {
          console.error('No fue posible cargar datos de renovación:', error);
          this.errorMessage.set(
            toUserMessage(error, {
              DEFAULT: 'No fue posible consultar la barbería y los planes disponibles. Inténtalo nuevamente.'
            })
          );
        }
      });
  }

  private listenForPayment(response: SubscriptionCreationResponse): void {
    this.paymentSubscription?.unsubscribe();

    // PUT /renew del backend no devuelve la referencia del pago (orderId):
    // sin ella no hay seguimiento en tiempo real, se consulta el estado del plan.
    if (!response.orderId?.trim()) {
      this.paymentMessage.set(
        'Renovación solicitada. Cuando la pasarela confirme el pago, el nuevo periodo aparecerá en "Suscripción y pagos".'
      );
      this.subscriptionAccess.refresh();
      return;
    }

    this.paymentSubscription = this.subscriptionWs.getPaymentStatus().subscribe({
      next: event => {
        this.paymentMessage.set(this.getPaymentUpdateMessage(event));
        this.subscriptionAccess.refresh();
      },
      error: (error: unknown) => {
        console.error('Error al recibir la actualización del pago:', error);
        this.errorMessage.set(
          'La renovación se solicitó, pero no se pudo recibir el estado del pago.'
        );
      }
    });

    try {
      this.subscriptionWs.connectWebSocket(response.orderId);
      this.paymentMessage.set(
        'Renovación solicitada. Esperando confirmación del pago.'
      );
    } catch (error: unknown) {
      console.error('No fue posible conectar con el estado del pago:', error);
      this.errorMessage.set(
        toUserMessage(error, {
          DEFAULT: 'La renovación se solicitó, pero no fue posible conectar con el estado del pago. Consulta el estado del plan en unos minutos.'
        })
      );
    }
  }

  private getPaymentUpdateMessage(event: unknown): string {
    return paymentUpdateMessage(event);
  }

  statusLabel(status: string | null | undefined): string {
    return subscriptionStatusLabel(status);
  }
}
