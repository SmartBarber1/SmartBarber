/**
 * Día no laborable o festivo de una barbería (aplica a todo su equipo).
 * Contrato del backend: /non-working-day-service.
 */
export interface NonWorkingDay {
    id: string;
    /** Fecha local en formato ISO: AAAA-MM-DD. */
    date: string;
    reason: string;
}

/** Datos para registrar un día; la barbería la determina el backend con la sesión. */
export interface NonWorkingDayRequest {
    date: string;
    reason: string;
}

export const NON_WORKING_DAY_REASON_MIN = 3;
export const NON_WORKING_DAY_REASON_MAX = 80;

export interface NonWorkingDayDraft {
    /** Valor del campo de fecha (AAAA-MM-DD) o vacío. */
    date: string;
    /** true cuando el navegador recibió una fecha escrita que no existe (p. ej. 29/02/2026). */
    dateIsUnparseable: boolean;
    reason: string;
}

/**
 * Valida un día no laborable. Devuelve el mensaje de error para el usuario,
 * con el campo afectado, o null si es válido.
 */
export function validateNonWorkingDay(
    draft: NonWorkingDayDraft,
    existing: readonly Pick<NonWorkingDay, 'date'>[],
    today: Date = new Date()
): { field: 'date' | 'reason'; message: string } | null {
    if (draft.dateIsUnparseable) {
        return {
            field: 'date',
            message: 'La fecha ingresada no existe. Revisa el día y el mes (por ejemplo, febrero de 2026 solo tiene 28 días).'
        };
    }

    if (!draft.date) {
        return { field: 'date', message: 'Selecciona la fecha del día no laborable.' };
    }

    if (!isRealIsoDate(draft.date)) {
        return {
            field: 'date',
            message: 'La fecha ingresada no existe. Revisa el día y el mes (por ejemplo, febrero de 2026 solo tiene 28 días).'
        };
    }

    if (draft.date < toIsoDate(today)) {
        return { field: 'date', message: 'No puedes registrar una fecha que ya pasó.' };
    }

    if (existing.some(day => day.date === draft.date)) {
        return { field: 'date', message: 'Esa fecha ya está registrada como día no laborable.' };
    }

    const reason = normalizeReason(draft.reason);

    if (reason.length < NON_WORKING_DAY_REASON_MIN) {
        return { field: 'reason', message: `Escribe el motivo (mínimo ${NON_WORKING_DAY_REASON_MIN} caracteres).` };
    }

    if (reason.length > NON_WORKING_DAY_REASON_MAX) {
        return { field: 'reason', message: `El motivo puede tener máximo ${NON_WORKING_DAY_REASON_MAX} caracteres.` };
    }

    return null;
}

export function normalizeReason(value: string | null | undefined): string {
    return (value ?? '').replace(/\s+/g, ' ').trim();
}

/** Fecha local (no UTC) en formato AAAA-MM-DD. */
export function toIsoDate(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Convierte AAAA-MM-DD a una fecha local sin desfase de zona horaria. */
export function fromIsoDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);

    return new Date(year, month - 1, day);
}

function isRealIsoDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    return toIsoDate(fromIsoDate(value)) === value;
}
