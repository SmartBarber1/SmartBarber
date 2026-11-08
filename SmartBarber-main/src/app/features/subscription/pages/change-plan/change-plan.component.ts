import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { GetCurrentSubscriptionUseCase } from '../../application/use-cases/get-current-subscription.use-case';
import { GetSubscriptionPlansUseCase } from '../../application/use-cases/get-subscription-plans.use-case';
import { ChangeSubscriptionPlanUseCase } from '../../application/use-cases/change-subscription-plan.use-case';

import { SubscriptionPlan } from '../../domain/models/subscription-plan.model';
import { CurrentSubscription } from '../../domain/models/current-subscription.model';
import {
  ChangePlanResponse
} from '../../domain/models/change-plan.model';

@Component({
  selector: 'app-change-plan',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink
  ],
  templateUrl: './change-plan.component.html',
  styleUrl: './change-plan.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChangePlanComponent implements OnInit {

  private readonly getCurrentSubscriptionUseCase =
    inject(GetCurrentSubscriptionUseCase);

  private readonly getSubscriptionPlansUseCase =
    inject(GetSubscriptionPlansUseCase);

  private readonly changeSubscriptionPlanUseCase =
    inject(ChangeSubscriptionPlanUseCase);

  readonly currentSubscription =
    signal<CurrentSubscription | null>(null);

  readonly plans =
    signal<SubscriptionPlan[]>([]);

  readonly selectedPlan =
    signal<SubscriptionPlan | null>(null);

  readonly loading =
    signal(false);

  readonly changingPlan =
    signal(false);

  readonly showConfirmation =
    signal(false);

  readonly changeCompleted =
    signal(false);

  readonly errorMessage =
    signal<string | null>(null);

  readonly successResponse =
    signal<ChangePlanResponse | null>(null);

  readonly hasSelection =
    computed(() => this.selectedPlan() !== null);

  readonly planDifference =
    computed(() => {

      const current = this.currentSubscription()?.plan;
      const selected = this.selectedPlan();

      if (!current || !selected) {
        return null;
      }

      return selected.price - current.price;
    });

  ngOnInit(): void {
    this.loadSubscriptionData();
  }

  private loadSubscriptionData(): void {

    this.loading.set(true);
    this.errorMessage.set(null);

    this.getCurrentSubscriptionUseCase
      .execute()
      .subscribe({
        next: (subscription) => {
          this.currentSubscription.set(subscription);
          this.loadPlans();
        },
        error: () => {
          this.loading.set(false);
          this.errorMessage.set(
            'No fue posible consultar la suscripción actual.'
          );
        }
      });
  }

  private loadPlans(): void {

    this.getSubscriptionPlansUseCase
      .execute()
      .subscribe({
        next: (plans) => {
          this.plans.set(
            plans.filter(plan => plan.active)
          );

          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.errorMessage.set(
            'No fue posible consultar los planes disponibles.'
          );
        }
      });
  }

  selectPlan(plan: SubscriptionPlan): void {

    const currentPlan =
      this.currentSubscription()?.plan;

    if (!currentPlan) {
      return;
    }

    if (plan.id === currentPlan.id) {
      this.selectedPlan.set(null);
      return;
    }

    this.selectedPlan.set(plan);
    this.errorMessage.set(null);
    this.changeCompleted.set(false);
  }

  openConfirmation(): void {

    if (!this.selectedPlan()) {
      return;
    }

    this.showConfirmation.set(true);
    this.errorMessage.set(null);
  }

  cancelConfirmation(): void {
    this.showConfirmation.set(false);
  }

  confirmChange(): void {

    const subscription =
      this.currentSubscription();

    const selected =
      this.selectedPlan();

    if (!subscription || !selected) {
      return;
    }

    this.changingPlan.set(true);
    this.errorMessage.set(null);

    this.changeSubscriptionPlanUseCase
      .execute({
        subscriptionId: subscription.id,
        newPlanId: selected.id
      })
      .subscribe({
        next: (response) => {

          this.successResponse.set(response);

          this.showConfirmation.set(false);
          this.changeCompleted.set(true);
          this.changingPlan.set(false);

          this.currentSubscription.update(
            current => current
              ? {
                  ...current,
                  plan: response.newPlan,
                  renewalDate: response.nextBillingDate
                }
              : current
          );

          this.selectedPlan.set(null);
        },

        error: (error) => {

          this.changingPlan.set(false);

          this.errorMessage.set(
            this.getPaymentOrValidationError(error)
          );
        }
      });
  }

  private getPaymentOrValidationError(
    error: unknown
  ): string {

    const response =
      error as {
        error?: {
          code?: string;
          message?: string;
        };
      };

    const code =
      response.error?.code;

    switch (code) {

      case 'PAYMENT_FAILED':
        return 'No fue posible procesar el pago del cambio de plan.';

      case 'INVALID_PLAN':
        return 'El plan seleccionado no es válido.';

      case 'SAME_PLAN':
        return 'El plan seleccionado ya es tu plan actual.';

      case 'SUBSCRIPTION_INACTIVE':
        return 'La suscripción no se encuentra activa.';

      case 'PAYMENT_METHOD_REQUIRED':
        return 'Debes tener un método de pago válido para cambiar de plan.';

      default:
        return 'El cambio de plan todavía no está disponible. Puedes renovar con otro plan cuando termine el periodo actual.';
    }
  }

  isCurrentPlan(plan: SubscriptionPlan): boolean {

    return this.currentSubscription()?.plan.id === plan.id;
  }

  formatCurrency(
    value: number,
    currency: string
  ): string {

    return new Intl.NumberFormat(
      'es-CO',
      {
        style: 'currency',
        currency,
        maximumFractionDigits: 0
      }
    ).format(value);
  }

  formatDate(date: string): string {

    return new Intl.DateTimeFormat(
      'es-CO',
      {
        dateStyle: 'long'
      }
    ).format(new Date(date));
  }
}