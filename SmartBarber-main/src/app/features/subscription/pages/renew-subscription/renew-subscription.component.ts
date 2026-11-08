import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';

import { RouterLink } from '@angular/router';

import {
  CurrentSubscription,
  SubscriptionStatus
} from '../../domain/models/current-subscription.model';

import {
  RenewSubscriptionResponse,
  RenewalProcessStatus
} from '../../domain/models/renew-subscription.model';

import { GetCurrentSubscriptionUseCase } from '../../application/use-cases/get-current-subscription.use-case';
import { RenewSubscriptionUseCase } from '../../application/use-cases/renew-subscription.use-case';

import { toUserMessage } from '../../../../core/errors';
@Component({
  selector: 'app-renew-subscription',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './renew-subscription.component.html',
  styleUrl: './renew-subscription.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RenewSubscriptionComponent {

  private readonly getCurrentSubscriptionUseCase = inject(
    GetCurrentSubscriptionUseCase
  );

  private readonly renewSubscriptionUseCase = inject(
    RenewSubscriptionUseCase
  );

  readonly currentSubscription = signal<CurrentSubscription | null>(null);

  readonly processStatus = signal<RenewalProcessStatus>('IDLE');

  readonly errorMessage = signal<string | null>(null);

  readonly confirmationMessage = signal<string | null>(null);

  readonly paymentReference = signal<string | null>(null);

  readonly loadingSubscription = signal(true);

  readonly renewalAvailable = computed(() => {
    const subscription = this.currentSubscription();

    if (!subscription) {
      return false;
    }

    return [
      'ACTIVE',
      'PAST_DUE',
      'EXPIRED'
    ].includes(subscription.status);
  });

  readonly renewalCost = computed(() => {
    return this.currentSubscription()?.plan.price ?? 0;
  });

  readonly planName = computed(() => {
    return this.currentSubscription()?.plan.name ?? '';
  });

  readonly expirationDate = computed(() => {
    return this.currentSubscription()?.renewalDate ?? '';
  });

  constructor() {
    this.loadSubscription();
  }

  private loadSubscription(): void {
    this.loadingSubscription.set(true);
    this.errorMessage.set(null);

    this.getCurrentSubscriptionUseCase.execute().subscribe({
      next: subscription => {
        this.currentSubscription.set(subscription);
        this.loadingSubscription.set(false);
      },

      error: error => {
        this.loadingSubscription.set(false);
        this.errorMessage.set(
          this.getErrorMessage(error)
        );
      }
    });
  }

  renewSubscription(): void {
    const subscription = this.currentSubscription();

    if (!subscription || !this.renewalAvailable()) {
      return;
    }

    this.processStatus.set('PROCESSING');
    this.errorMessage.set(null);
    this.confirmationMessage.set(null);
    this.paymentReference.set(null);

    const request = {
      subscriptionId: subscription.id,
      returnUrl: `${window.location.origin}/subscription`
    };

    this.renewSubscriptionUseCase.execute(request).subscribe({
      next: response => {
        this.handleRenewalResponse(response);
      },

      error: error => {
        this.processStatus.set('ERROR');
        this.errorMessage.set(
          this.getErrorMessage(error)
        );
      }
    });
  }

  private handleRenewalResponse(
    response: RenewSubscriptionResponse
  ): void {

    this.paymentReference.set(
      response.paymentReference ?? null
    );

    if (response.status === 'RENEWED') {
      if (response.subscription) {
        this.currentSubscription.set(
          response.subscription
        );
      }

      this.processStatus.set('SUCCESS');

      this.confirmationMessage.set(
        response.message ||
        'Your subscription has been renewed successfully.'
      );

      return;
    }

    if (
      response.status === 'PENDING_PAYMENT' &&
      response.paymentUrl
    ) {
      this.processStatus.set('REDIRECTING');

      window.location.assign(
        response.paymentUrl
      );

      return;
    }

    this.processStatus.set('ERROR');

    this.errorMessage.set(
      response.message ||
      'The renewal process could not be completed.'
    );
  }

  reloadSubscription(): void {
    this.processStatus.set('IDLE');
    this.errorMessage.set(null);
    this.confirmationMessage.set(null);
    this.paymentReference.set(null);

    this.loadSubscription();
  }

  getStatusLabel(status: SubscriptionStatus): string {
    const labels: Record<SubscriptionStatus, string> = {
      ACTIVE: 'Active',
      PENDING: 'Pending',
      PAST_DUE: 'Past Due',
      CANCELLED: 'Cancelled',
      EXPIRED: 'Expired',
      PENDING_CANCELLATION: 'Pending Cancellation'
    };

    return labels[status];
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(value);
  }

  formatDate(date: string): string {
    if (!date) {
      return 'Not available';
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(parsedDate);
  }

  isProcessing(): boolean {
    return this.processStatus() === 'PROCESSING';
  }

  isRedirecting(): boolean {
    return this.processStatus() === 'REDIRECTING';
  }

  isSuccess(): boolean {
    return this.processStatus() === 'SUCCESS';
  }

  isError(): boolean {
    return this.processStatus() === 'ERROR';
  }

  private getErrorMessage(error: unknown): string {

    if (
      typeof error === 'object' &&
      error !== null &&
      'error' in error
    ) {
      const httpError = error as {
        error?: {
          message?: string;
        };
      };

      if (httpError.error) {
        return toUserMessage(error, {
          SB_005: 'Ya tienes una renovación pendiente de pago o aprobada. Espera a que se confirme antes de solicitar otra.',
          DEFAULT: 'No fue posible procesar la renovación. Inténtalo nuevamente.'
        });
      }
    }

    return 'No fue posible procesar la renovación. Inténtalo nuevamente.';
  }
}