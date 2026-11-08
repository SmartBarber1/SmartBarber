import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, Subscription } from 'rxjs';

import { SessionService } from '../../../../core/auth/services/session.service';
import { BarbershopSubscriptionAccessService } from '../../application/services/barbershop-subscription-access.service';
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
  selector: 'app-subscription-status',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './subscription-status.component.html',
  styleUrl: './subscription-status.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubscriptionStatusComponent implements OnInit, OnDestroy {
  private readonly sessionService = inject(SessionService);
  private readonly subscriptionAccess = inject(BarbershopSubscriptionAccessService);
  private readonly subscriptionApi = inject(SubscriptionApiService);
  private readonly subscriptionWs = inject(SubscriptionWsService);
  private paymentSubscription?: Subscription;

  readonly accessState = this.subscriptionAccess.state;
  readonly plans = signal<SubscriptionCatalogPlan[]>([]);
  readonly selectedPlanId = signal<number | null>(null);
  readonly selectedPlan = computed(() =>
    this.plans().find(plan => plan.id === this.selectedPlanId()) ?? null
  );
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly errorMessage = signal('');
  readonly paymentMessage = signal('');
  readonly createdSubscription = signal<SubscriptionCreationResponse | null>(null);

  ngOnInit(): void {
    this.loadPlans();
  }

  ngOnDestroy(): void {
    this.paymentSubscription?.unsubscribe();
    this.subscriptionWs.disconnectWebSocket();
  }

  selectPlan(planId: number): void {
    this.selectedPlanId.set(planId);
    this.errorMessage.set('');
    this.paymentMessage.set('');
    this.createdSubscription.set(null);
  }

  canAcquireSubscription(): boolean {
    return [
      'inactive',
      'expired',
      'declined',
      'refunded'
    ].includes(this.accessState().status);
  }

  subscriptionStatusLabel(): string {
    switch (this.accessState().status) {
      case 'loading':
        return 'Verificando';
      case 'active':
        return 'Activa';
      case 'approved':
        return 'Aprobada';
      case 'pending':
        return 'Pendiente';
      case 'inactive':
        return 'Sin suscripción';
      case 'expired':
        return 'Vencida';
      case 'declined':
        return 'Rechazada';
      case 'refunded':
        return 'Reembolsada';
      case 'error':
        return 'No disponible';
      case 'unavailable':
        return 'Sin confirmar';
    }
  }

  acquireSubscription(): void {
    const plan = this.selectedPlan();

    if (!plan || this.submitting() || !this.canAcquireSubscription()) {
      return;
    }

    this.errorMessage.set('');
    this.paymentMessage.set('');
    this.submitting.set(true);

    let request: Observable<SubscriptionCreationResponse>;
    try {
      request = this.subscriptionWs.createSubscription({
        subscriptionId: plan.id,
        duration: SUBSCRIPTION_DURATION,
        automaticRenew: false
      });
    } catch (error: unknown) {
      this.submitting.set(false);
      this.errorMessage.set(
        toUserMessage(error, {
          DEFAULT: 'No fue posible validar el perfil para adquirir el plan.'
        })
      );
      return;
    }

    request.subscribe({
      next: response => {
        this.submitting.set(false);
        this.createdSubscription.set(response);
        this.listenForPayment(response);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        console.error('No fue posible crear la solicitud de suscripción:', error);
        this.errorMessage.set(
          'No fue posible iniciar la adquisición. Inténtalo nuevamente.'
        );
      }
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(value);
  }

  reloadPlans(): void {
    this.loadPlans();
  }

  private loadPlans(): void {
    const session = this.sessionService.currentSession;

    if (
      !session ||
      session.role !== 'ADMIN' ||
      !session.barberId ||
      !session.barbershopId
    ) {
      this.loading.set(false);
      this.errorMessage.set(
        'La adquisición está disponible para el administrador asociado a una barbería. Inicia sesión nuevamente si tu perfil fue actualizado.'
      );
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.subscriptionApi.getSubscriptionCatalog().subscribe({
      next: plans => {
        this.plans.set(plans);
        if (plans.length === 1) {
          this.selectedPlanId.set(plans[0].id);
        }
        this.loading.set(false);
      },
      error: (error: unknown) => {
        console.error('No fue posible cargar los planes de suscripción:', error);
        this.errorMessage.set(
          'No fue posible consultar los planes disponibles. Inténtalo nuevamente.'
        );
        this.loading.set(false);
      }
    });
  }

  private listenForPayment(
    response: SubscriptionCreationResponse
  ): void {
    this.paymentSubscription?.unsubscribe();
    this.paymentSubscription = this.subscriptionWs.getPaymentStatus().subscribe({
      next: event => {
        this.paymentMessage.set(this.getPaymentUpdateMessage(event));
        this.subscriptionAccess.refresh();
      },
      error: (error: unknown) => {
        console.error('Error al recibir la actualización del pago:', error);
        this.errorMessage.set(
          'La solicitud se creó, pero no se pudo recibir el estado del pago.'
        );
      }
    });

    try {
      this.subscriptionWs.connectWebSocket(response.orderId);
      this.paymentMessage.set(
        'Solicitud creada. Esperando confirmación del pago.'
      );
    } catch (error: unknown) {
      console.error('No fue posible conectar con el estado del pago:', error);
      this.errorMessage.set(
        toUserMessage(error, {
          DEFAULT: 'La solicitud se creó, pero no fue posible conectar con el estado del pago. Consulta el estado del plan en unos minutos.'
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
