import { Injectable } from '@angular/core';

import { Holiday } from './holiday.model';

/**
 * Almacenamiento de días no laborables. El backend todavía no expone un
 * endpoint para esto; cuando exista, basta con proveer otra implementación.
 */
export abstract class HolidayRepository {
    abstract list(barbershopId: string): Holiday[];
    abstract save(barbershopId: string, holidays: Holiday[]): void;
}

/**
 * Guarda los días en este navegador, separados por barbería.
 * Es una solución temporal: no se comparte con otros equipos ni con las reservas.
 */
@Injectable({ providedIn: 'root' })
export class LocalHolidayRepository extends HolidayRepository {

    private static readonly PREFIX = 'smartbarber.holidays.';

    override list(barbershopId: string): Holiday[] {
        try {
            const raw = localStorage.getItem(LocalHolidayRepository.PREFIX + barbershopId);
            const parsed: unknown = raw ? JSON.parse(raw) : [];

            return Array.isArray(parsed)
                ? parsed.filter(isHoliday)
                : [];
        } catch {
            return [];
        }
    }

    override save(barbershopId: string, holidays: Holiday[]): void {
        try {
            localStorage.setItem(
                LocalHolidayRepository.PREFIX + barbershopId,
                JSON.stringify(holidays)
            );
        } catch {
            // Almacenamiento deshabilitado (modo privado, políticas del navegador).
        }
    }
}

function isHoliday(value: unknown): value is Holiday {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const item = value as Record<string, unknown>;

    return typeof item['id'] === 'string'
        && typeof item['date'] === 'string'
        && typeof item['reason'] === 'string';
}
