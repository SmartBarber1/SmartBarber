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
import { CancelSubscriptionUseCase } from '../../application/use-cases/cancel-subscription.use-case';

import { CurrentSubscription } from '../../domain/models/current-subscription.model';

import {
    CancelSubscriptionResponse
} from '../../domain/models/cancel-subscription.model';

@Component({
    selector: 'app-cancel-subscription',
    standalone: true,

    imports: [
        CommonModule,
        RouterLink
    ],

    templateUrl: './cancel-subscription.component.html',

    styleUrl: './cancel-subscription.component.css',

    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CancelSubscriptionComponent implements OnInit {

    private readonly getCurrentSubscriptionUseCase =
        inject(GetCurrentSubscriptionUseCase);

    private readonly cancelSubscriptionUseCase =
        inject(CancelSubscriptionUseCase);

    readonly currentSubscription =
        signal<CurrentSubscription | null>(null);

    readonly selectedReason =
        signal<string>('');

    readonly reasonDetail =
        signal<string>('');

    readonly showConfirmation =
        signal(false);

    readonly loading =
        signal(false);

    readonly cancelling =
        signal(false);

    readonly cancellationCompleted =
        signal(false);

    readonly errorMessage =
        signal<string | null>(null);

    readonly successResponse =
        signal<CancelSubscriptionResponse | null>(null);

    readonly cancellationReasons = [
        'El precio no se ajusta a mis necesidades',
        'La barbería ya no requiere el servicio',
        'No estoy utilizando todas las funcionalidades',
        'Problemas con el servicio',
        'Voy a utilizar otra plataforma',
        'Otro'
    ];

    readonly reasonRequired =
        computed(
            () =>
                this.currentSubscription()
                    ?.cancellationReasonRequired === true
        );

    readonly canContinue =
        computed(() => {

            if (!this.reasonRequired()) {
                return true;
            }

            return this.selectedReason().trim().length > 0;
        });

    ngOnInit(): void {
        this.loadSubscription();
    }

    private loadSubscription(): void {

        this.loading.set(true);
        this.errorMessage.set(null);

        this.getCurrentSubscriptionUseCase
            .execute()
            .subscribe({

                next: (subscription) => {

                    this.currentSubscription.set(subscription);

                    this.loading.set(false);

                },

                error: (error) => {

                    this.loading.set(false);

                    this.errorMessage.set(
                        this.getErrorMessage(error)
                    );

                }

            });
    }

    selectReason(reason: string): void {

        this.selectedReason.set(reason);

        this.errorMessage.set(null);
    }

    updateReasonDetail(event: Event): void {

        const input =
            event.target as HTMLTextAreaElement;

        this.reasonDetail.set(input.value);
    }

    openConfirmation(): void {

        if (!this.canContinue()) {

            this.errorMessage.set(
                'Debes seleccionar un motivo para continuar.'
            );

            return;
        }

        this.showConfirmation.set(true);

        this.errorMessage.set(null);
    }

    cancelConfirmation(): void {

        if (this.cancelling()) {
            return;
        }

        this.showConfirmation.set(false);
    }

    confirmCancellation(): void {

        const subscription =
            this.currentSubscription();

        if (!subscription) {
            return;
        }

        this.cancelling.set(true);
        this.errorMessage.set(null);

        this.cancelSubscriptionUseCase
            .execute({

                subscriptionId:
                    subscription.id,

                reason:
                    this.selectedReason() || undefined,

                reasonDetail:
                    this.reasonDetail().trim() || undefined

            })
            .subscribe({

                next: (response) => {

                    this.successResponse.set(response);

                    this.cancellationCompleted.set(true);

                    this.showConfirmation.set(false);

                    this.cancelling.set(false);

                    this.currentSubscription.update(current => {

                        if (!current) {
                            return current;
                        }

                        return {
                            ...current,
                            status: response.status,
                            cancellationEffectiveDate: response.effectiveDate
                        };

                    });

                },

                error: (error) => {

                    this.cancelling.set(false);

                    this.errorMessage.set(
                        this.getErrorMessage(error)
                    );

                }

            });
    }

    isActive(): boolean {

        const status =
            this.currentSubscription()?.status;

        return status === 'ACTIVE';
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

    private getErrorMessage(error: unknown): string {

        const response =
            error as {
                error?: {
                    code?: string;
                    message?: string;
                };
            };

        switch (response.error?.code) {

            case 'SUBSCRIPTION_NOT_FOUND':
                return 'No se encontró la suscripción.';

            case 'SUBSCRIPTION_ALREADY_CANCELLED':
                return 'La suscripción ya se encuentra cancelada.';

            case 'SUBSCRIPTION_INACTIVE':
                return 'La suscripción no se encuentra activa.';

            case 'CANCELLATION_REASON_REQUIRED':
                return 'Debes seleccionar un motivo para cancelar la suscripción.';

            case 'CANCELLATION_NOT_ALLOWED':
                return 'La suscripción no puede cancelarse en este momento.';

            case 'PAYMENT_SERVICE_ERROR':
                return 'No fue posible procesar la cancelación debido a un problema con el servicio de pagos.';

            default:
                return 'La cancelación de la suscripción todavía no está disponible. Comunícate con soporte para cancelarla.';
        }
    }
}