import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    OnInit,
    signal
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
    GetPaymentHistoryUseCase
} from '../../application/use-cases/get-payment-history.use-case';

import {
    PaymentHistory,
    PaymentHistoryFilters
} from '../../domain/models/payment-history.model';

import {
    Payment,
    PaymentStatus
} from '../../domain/models/payment.model';

@Component({
    selector: 'app-payment-history',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        RouterLink
    ],
    templateUrl: './payment-history.component.html',
    styleUrl: './payment-history.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentHistoryComponent implements OnInit {

    private readonly getPaymentHistoryUseCase =
        inject(GetPaymentHistoryUseCase);

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    readonly payments = signal<Payment[]>([]);

    readonly loading = signal(false);

    readonly errorMessage = signal<string | null>(null);

    readonly currentPage = signal(0);

    readonly pageSize = signal(10);

    readonly totalElements = signal(0);

    readonly totalPages = signal(0);

    readonly selectedStatus = signal<PaymentStatus | ''>('');

    readonly fromDate = signal('');

    readonly toDate = signal('');

    // -------------------------------------------------------------------------
    // Computed state
    // -------------------------------------------------------------------------

    readonly hasPreviousPage = computed(
        () => this.currentPage() > 0
    );

    readonly hasNextPage = computed(
        () =>
            this.currentPage() + 1 <
            this.totalPages()
    );

    readonly pageLabel = computed(() => {
        const total = this.totalPages();

        if (total === 0) {
            return 'Página 0 de 0';
        }

        return `Página ${this.currentPage() + 1} de ${total}`;
    });

    // -------------------------------------------------------------------------
    // Options
    // -------------------------------------------------------------------------

    readonly paymentStatusOptions: Array<{
        value: PaymentStatus;
        label: string;
    }> = [
        {
            value: 'PAID',
            label: 'Pagado'
        },
        {
            value: 'PENDING',
            label: 'Pendiente'
        },
        {
            value: 'FAILED',
            label: 'Fallido'
        },
        {
            value: 'REFUNDED',
            label: 'Reembolsado'
        },
        {
            value: 'CANCELLED',
            label: 'Cancelado'
        }
    ];

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    ngOnInit(): void {
        this.loadPaymentHistory(0);
    }

    // -------------------------------------------------------------------------
    // Filters
    // -------------------------------------------------------------------------

    applyFilters(): void {
        if (!this.isDateRangeValid()) {
            this.errorMessage.set(
                'La fecha inicial no puede ser posterior a la fecha final.'
            );

            return;
        }

        this.loadPaymentHistory(0);
    }

    clearFilters(): void {
        this.selectedStatus.set('');
        this.fromDate.set('');
        this.toDate.set('');
        this.errorMessage.set(null);

        this.loadPaymentHistory(0);
    }

    onStatusChange(value: string): void {
        this.selectedStatus.set(
            this.toPaymentStatus(value)
        );
    }

    onFromDateChange(value: string): void {
        this.fromDate.set(value);
    }

    onToDateChange(value: string): void {
        this.toDate.set(value);
    }

    // -------------------------------------------------------------------------
    // Pagination
    // -------------------------------------------------------------------------

    changePage(page: number): void {
        if (
            page < 0 ||
            page >= this.totalPages() ||
            page === this.currentPage()
        ) {
            return;
        }

        this.loadPaymentHistory(page);
    }

    previousPage(): void {
        this.changePage(
            this.currentPage() - 1
        );
    }

    nextPage(): void {
        this.changePage(
            this.currentPage() + 1
        );
    }

    // -------------------------------------------------------------------------
    // Template helpers
    // -------------------------------------------------------------------------

    trackPayment(
        _: number,
        payment: Payment
    ): string {
        return payment.id;
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
                dateStyle: 'medium'
            }
        ).format(
            new Date(date)
        );
    }

    getStatusLabel(
        status: PaymentStatus
    ): string {
        const option =
            this.paymentStatusOptions.find(
                item => item.value === status
            );

        return option?.label ?? status;
    }

    // -------------------------------------------------------------------------
    // Private methods
    // -------------------------------------------------------------------------

    private loadPaymentHistory(
        page: number
    ): void {
        this.loading.set(true);
        this.errorMessage.set(null);

        const filters: PaymentHistoryFilters = {
            page,
            size: this.pageSize(),

            ...(this.selectedStatus()
                ? {
                    status:
                        this.selectedStatus() as PaymentStatus
                }
                : {}),

            ...(this.fromDate()
                ? {
                    fromDate: this.fromDate()
                }
                : {}),

            ...(this.toDate()
                ? {
                    toDate: this.toDate()
                }
                : {})
        };

        this.getPaymentHistoryUseCase
            .execute(filters)
            .subscribe({
                next: (
                    history: PaymentHistory
                ) => {
                    this.payments.set(
                        history.content
                    );

                    this.currentPage.set(
                        history.page
                    );

                    this.pageSize.set(
                        history.size
                    );

                    this.totalElements.set(
                        history.totalElements
                    );

                    this.totalPages.set(
                        history.totalPages
                    );

                    this.loading.set(false);
                },

                error: (error: unknown) => {
                    this.loading.set(false);

                    this.errorMessage.set(
                        this.getErrorMessage(error)
                    );
                }
            });
    }

    private isDateRangeValid(): boolean {
        const from = this.fromDate();
        const to = this.toDate();

        return (
            !from ||
            !to ||
            from <= to
        );
    }

    private toPaymentStatus(
        value: string
    ): PaymentStatus | '' {
        return this.paymentStatusOptions.some(
            option => option.value === value
        )
            ? value as PaymentStatus
            : '';
    }

    private getErrorMessage(
        error: unknown
    ): string {
        const response = error as {
            error?: {
                code?: string;
                message?: string;
            };
        };

        switch (response.error?.code) {
            case 'SUBSCRIPTION_NOT_FOUND':
                return (
                    'No se encontró la suscripción de la barbería.'
                );

            case 'PAYMENT_HISTORY_UNAVAILABLE':
                return (
                    'No fue posible consultar el historial de pagos.'
                );

            case 'UNAUTHORIZED':
                return (
                    'No tienes autorización para consultar el historial de pagos.'
                );

            default:
                return (
                    'No fue posible cargar el historial de pagos.'
                );
        }
    }
}
