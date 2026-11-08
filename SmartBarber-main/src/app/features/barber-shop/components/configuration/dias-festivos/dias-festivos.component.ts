import { Component, Input, OnChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SessionService } from '../../../../../core/auth/services/session.service';
import {
    HOLIDAY_REASON_MAX,
    Holiday,
    fromIsoDate,
    normalizeReason,
    toIsoDate,
    validateHoliday
} from './holiday.model';
import { HolidayRepository, LocalHolidayRepository } from './holiday.repository';

@Component({
    selector: 'app-dias-festivos',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './dias-festivos.component.html',
    styleUrls: ['../shared/vintage-shared.css', './dias-festivos.component.css'],
    providers: [{ provide: HolidayRepository, useExisting: LocalHolidayRepository }]
})
export class DiasFestivosComponent implements OnChanges {

    private readonly repository = inject(HolidayRepository);
    private readonly sessionService = inject(SessionService);

    @Input() barberList: { id?: string; name?: string }[] = [];

    readonly reasonMax = HOLIDAY_REASON_MAX;
    readonly minDate = toIsoDate(new Date());

    holidays: Holiday[] = [];
    newHolidayDate = '';
    newHolidayDesc = '';

    errorMessage = '';
    errorField: 'date' | 'reason' | null = null;
    successMessage = '';

    get activeShopName(): string {
        return this.barberList.length > 0 && this.barberList[0].name
            ? this.barberList[0].name
            : 'No disponible';
    }

    private get barbershopId(): string {
        return this.barberList[0]?.id ?? this.sessionService.getBarbershopId() ?? '';
    }

    ngOnChanges(): void {
        this.load();
    }

    addHoliday(dateInput: HTMLInputElement): void {
        this.successMessage = '';

        const error = validateHoliday(
            {
                date: this.newHolidayDate,
                dateIsUnparseable: dateInput.validity.badInput,
                reason: this.newHolidayDesc
            },
            this.holidays
        );

        if (error) {
            this.errorMessage = error.message;
            this.errorField = error.field;
            return;
        }

        if (!this.barbershopId) {
            this.errorMessage = 'No encontramos la barbería de tu sesión. Vuelve a iniciar sesión.';
            this.errorField = null;
            return;
        }

        const holiday: Holiday = {
            id: `${this.newHolidayDate}-${Date.now()}`,
            date: this.newHolidayDate,
            reason: normalizeReason(this.newHolidayDesc)
        };

        this.holidays = sortByDate([...this.holidays, holiday]);
        this.repository.save(this.barbershopId, this.holidays);

        this.successMessage = `Día no laborable agregado: ${this.formatDate(holiday.date)}.`;
        this.newHolidayDate = '';
        this.newHolidayDesc = '';
        dateInput.value = '';
        this.clearError();
    }

    removeHoliday(id: string): void {
        const removed = this.holidays.find(h => h.id === id);

        this.holidays = this.holidays.filter(h => h.id !== id);
        this.repository.save(this.barbershopId, this.holidays);
        this.successMessage = removed
            ? `Se eliminó el ${this.formatDate(removed.date)}.`
            : '';
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

    private load(): void {
        this.holidays = this.barbershopId
            ? sortByDate(this.repository.list(this.barbershopId))
            : [];
    }

    private clearError(): void {
        this.errorMessage = '';
        this.errorField = null;
    }
}

function sortByDate(holidays: Holiday[]): Holiday[] {
    return [...holidays].sort((a, b) => a.date.localeCompare(b.date));
}
