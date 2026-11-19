import { Component, DestroyRef, Input, OnChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { SessionService } from '../../../../../core/auth/services/session.service';
import { ErrorMessageOverrides, toApiError } from '../../../../../core/errors';
import {
    NON_WORKING_DAY_REASON_MAX,
    NonWorkingDay,
    fromIsoDate,
    normalizeReason,
    toIsoDate,
    validateNonWorkingDay
} from '../../../domain/models/non-working-day.model';
import { NonWorkingDayRepository } from '../../../domain/repositories/non-working-day.repository';

/** Respuestas del backend que se muestran junto a un campo. */
const FIELD_BY_CODE: Readonly<Record<string, 'date' | 'reason'>> = {
    ND_002: 'date',
    ND_003: 'date',
    ND_001: 'reason'
};

const ERROR_MESSAGES: ErrorMessageOverrides = {
    ND_001: 'Revisa el motivo: debe tener entre 3 y 80 caracteres.',
    ND_002: 'Esa fecha ya está registrada como día no laborable.',
    ND_003: 'No puedes registrar una fecha que ya pasó.',
    ND_004: 'Ese día ya no existe; la lista se actualizó.',
    ND_007: 'Solo el administrador de la barbería puede gestionar los días no laborables.',
    VALIDATION: 'Revisa la fecha y el motivo.',
    DEFAULT: 'No fue posible guardar el cambio. Inténtalo nuevamente.'
};

@Component({
    selector: 'app-dias-festivos',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './dias-festivos.component.html',
    styleUrls: ['../shared/vintage-shared.css', './dias-festivos.component.css']
})
export class DiasFestivosComponent implements OnChanges {

    private readonly repository = inject(NonWorkingDayRepository);
    private readonly sessionService = inject(SessionService);
    private readonly destroyRef = inject(DestroyRef);

    @Input() barberList: { id?: string; name?: string }[] = [];

    readonly reasonMax = NON_WORKING_DAY_REASON_MAX;
    readonly minDate = toIsoDate(new Date());

    holidays: NonWorkingDay[] = [];
    newHolidayDate = '';
    newHolidayDesc = '';

    loading = false;
    saving = false;
    deletingId: string | null = null;
    loadError = '';

    errorMessage = '';
    errorField: 'date' | 'reason' | null = null;
    successMessage = '';

    private loadedFor = '';

    get activeShopName(): string {
        return this.barberList.length > 0 && this.barberList[0].name
            ? this.barberList[0].name
            : 'No disponible';
    }

    private get barbershopId(): string {
        return this.sessionService.getBarbershopId()
            ?? (this.barberList.length > 0 ? this.barberList[0].id ?? '' : '');
    }

    ngOnChanges(): void {
        if (this.barbershopId && this.barbershopId !== this.loadedFor) {
            this.load();
        }
    }

    load(): void {
        const barbershopId = this.barbershopId;

        if (!barbershopId) {
            return;
        }

        this.loadedFor = barbershopId;
        this.loading = true;
        this.loadError = '';

        this.repository.list(barbershopId)
            .pipe(
                finalize(() => this.loading = false),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe({
                next: days => this.holidays = sortByDate(days),
                error: error => this.loadError = toApiError(error, {
                    DEFAULT: 'No fue posible cargar los días no laborables.'
                }).message
            });
    }

    addHoliday(dateInput: HTMLInputElement): void {
        if (this.saving) {
            return;
        }

        this.successMessage = '';

        const error = validateNonWorkingDay(
            {
                date: this.newHolidayDate,
                dateIsUnparseable: dateInput.validity.badInput,
                reason: this.newHolidayDesc
            },
            this.holidays
        );

        if (error) {
            this.showError(error.message, error.field);
            return;
        }

        const barbershopId = this.barbershopId;

        if (!barbershopId) {
            this.showError('No encontramos la barbería de tu sesión. Vuelve a iniciar sesión.', null);
            return;
        }

        this.saving = true;
        this.clearError();

        this.repository.create(barbershopId, {
            date: this.newHolidayDate,
            reason: normalizeReason(this.newHolidayDesc)
        })
            .pipe(
                finalize(() => this.saving = false),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe({
                next: created => {
                    this.holidays = sortByDate([...this.holidays, created]);
                    this.successMessage = `Día no laborable agregado: ${this.formatDate(created.date)}.`;
                    this.newHolidayDate = '';
                    this.newHolidayDesc = '';
                    dateInput.value = '';
                },
                error: err => {
                    const apiError = toApiError(err, ERROR_MESSAGES);
                    const byCode = apiError.code ? FIELD_BY_CODE[apiError.code] : undefined;
                    const field: 'date' | 'reason' | null = byCode
                        ?? (apiError.fields['date'] ? 'date' : apiError.fields['reason'] ? 'reason' : null);

                    this.showError(apiError.message, field);
                }
            });
    }

    removeHoliday(day: NonWorkingDay): void {
        if (this.deletingId) {
            return;
        }

        this.successMessage = '';
        this.clearError();
        this.deletingId = day.id;

        this.repository.delete(this.barbershopId, day.id)
            .pipe(
                finalize(() => this.deletingId = null),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe({
                next: () => {
                    this.holidays = this.holidays.filter(h => h.id !== day.id);
                    this.successMessage = `Se eliminó el ${this.formatDate(day.date)}.`;
                },
                error: err => {
                    const apiError = toApiError(err, ERROR_MESSAGES);

                    if (apiError.code === 'ND_004') {
                        this.holidays = this.holidays.filter(h => h.id !== day.id);
                    }

                    this.showError(apiError.message, null);
                }
            });
    }

    /** Limpia el error del campo que el usuario está corrigiendo. */
    onFieldChange(field: 'date' | 'reason'): void {
        if (this.errorField === field) {
            this.clearError();
        }
    }

    formatDate(isoDate: string): string {
        return fromIsoDate(isoDate).toLocaleDateString('es-CO', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    trackById(_: number, day: NonWorkingDay): string {
        return day.id;
    }

    private showError(message: string, field: 'date' | 'reason' | null): void {
        this.errorMessage = message;
        this.errorField = field;
    }

    private clearError(): void {
        this.errorMessage = '';
        this.errorField = null;
    }
}

function sortByDate(days: NonWorkingDay[]): NonWorkingDay[] {
    return [...days].sort((a, b) => a.date.localeCompare(b.date));
}
