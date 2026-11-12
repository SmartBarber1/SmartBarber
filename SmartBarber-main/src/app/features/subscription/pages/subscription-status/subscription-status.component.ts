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

  private readonly PAYMENT_RESPONSE_TIMEOUT_MS = 15000;
  private paymentTimeoutId?: ReturnType<typeof setTimeout>;

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
  readonly paymentDelayNotice = signal(false);
  readonly createdSubscription = signal<SubscriptionCreationResponse | null>(null);

  ngOnInit(): void {
    this.loadPlans();
  }

  ngOnDestroy(): void {
    this.clearPaymentTimeout();
    this.paymentSubscription?.unsubscribe();
    this.subscriptionWs.disconnectWebSocket();
  }

  selectPlan(planId: number): void {
    if (this.submitting() || this.paymentInProgress()) {
      return;
    }

    this.selectedPlanId.set(planId);
    this.errorMessage.set('');
    this.paymentMessage.set('');
    this.createdSubscription.set(null);
    this.clearPaymentTimeout();
  }

  canAcquireSubscription(): boolean {
    return [
      'inactive',
      'expired',
      'declined',
      'refunded'
    ].includes(this.accessState().status);
  }

  paymentInProgress(): boolean {
    if (this.createdSubscription() === null) {
      return false;
    }
    // Solicitud creada: sigue en proceso salvo que el pago haya sido rechazado/reembolsado/vencido.
    return !['declined', 'refunded', 'expired'].includes(this.accessState().status);
  }

  isPurchaseBlocked(): boolean {
    return (
      this.submitting() ||
      this.loading() ||
      !this.canAcquireSubscription() ||
      this.paymentInProgress()
    );
  }

  purchaseButtonLabel(): string {
    if (this.submitting()) {
      return 'CREANDO SOLICITUD...';
    }

    const status = this.accessState().status;
    if (status === 'active') {
      return 'SUSCRIPCIÓN ACTIVA';
    }
    if (status === 'pending' || status === 'approved' || this.paymentInProgress()) {
      return 'SOLICITUD EN PROCESO';
    }
    return 'CONTINUAR CON EL PLAN';
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

    if (!plan || this.isPurchaseBlocked()) {
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
    this.clearPaymentTimeout();

    this.paymentSubscription = this.subscriptionWs.getPaymentStatus().subscribe({
      next: event => {
        console.log('Evento de pago recibido:', event); // temporal: quitar al terminar de probar
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

    this.startPaymentTimeout();

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

  showPaymentDelayNotice(): boolean {
    const status = this.accessState().status;
    return this.paymentDelayNotice() && status !== 'active' && status !== 'approved';
  }

  private startPaymentTimeout(): void {
    const initialStatus = this.accessState().status;

    this.paymentTimeoutId = setTimeout(() => {
      this.paymentTimeoutId = undefined;
      if (!this.isPaymentResolved(initialStatus)) {
        this.paymentDelayNotice.set(true);
      }
    }, this.PAYMENT_RESPONSE_TIMEOUT_MS);
  }

  private isPaymentResolved(initialStatus: string): boolean {
    const status = this.accessState().status;
    if (status === 'active' || status === 'approved') {
      return true;
    }
    return (
      status !== initialStatus &&
      ['declined', 'refunded', 'expired'].includes(status)
    );
  }

  private clearPaymentTimeout(): void {
    if (this.paymentTimeoutId) {
      clearTimeout(this.paymentTimeoutId);
      this.paymentTimeoutId = undefined;
    }
    this.paymentDelayNotice.set(false);
  }

  private getPaymentUpdateMessage(event: unknown): string {
    return paymentUpdateMessage(event);
  }

  statusLabel(status: string | null | undefined): string {
    return subscriptionStatusLabel(status);
  }
}