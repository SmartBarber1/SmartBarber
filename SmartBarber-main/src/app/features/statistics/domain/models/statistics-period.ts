import {
  StatisticsDateRange,
  StatisticsFilter
} from './statistics.model';

import { StatisticsFilterError } from '../errors/statistics.errors';

/** Límite del rango personalizado para acotar el volumen de cada consulta. */
export const MAX_RANGE_DAYS = 366;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const DAY_MS = 86_400_000;

export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

/** Convierte `YYYY-MM-DD` en fecha local; devuelve `null` si el valor no es una fecha real. */
export function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  const isSameDate =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  return isSameDate ? date : null;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);

  return result;
}

export function daysBetween(range: StatisticsDateRange): number {
  const from = parseIsoDate(range.from);
  const to = parseIsoDate(range.to);

  if (!from || !to) {
    return 0;
  }

  return Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
}

/** Periodo inmediatamente anterior con la misma cantidad de días. */
export function previousRange(range: StatisticsDateRange): StatisticsDateRange {
  const from = parseIsoDate(range.from) as Date;
  const days = daysBetween(range);

  return {
    from: toIsoDate(addDays(from, -days)),
    to: toIsoDate(addDays(from, -1))
  };
}

/**
 * Traduce el filtro elegido por el usuario a un rango de fechas válido.
 * Lanza `StatisticsFilterError` si el rango personalizado no es válido.
 */
export function resolveStatisticsRange(
  filter: StatisticsFilter,
  today: Date = new Date()
): StatisticsDateRange {
  const end = toIsoDate(today);

  switch (filter.period) {
    case 'DAY':
      return { from: end, to: end };

    case 'WEEK':
      return { from: toIsoDate(addDays(today, -6)), to: end };

    case 'MONTH':
      return {
        from: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
        to: end
      };

    case 'RANGE':
      return validateCustomRange(filter.customRange, today);

    default:
      throw new StatisticsFilterError('El periodo seleccionado no es válido.');
  }
}

function validateCustomRange(
  range: StatisticsDateRange | undefined,
  today: Date
): StatisticsDateRange {
  const from = parseIsoDate(range?.from);
  const to = parseIsoDate(range?.to);

  if (!from || !to) {
    throw new StatisticsFilterError('Selecciona una fecha inicial y una fecha final válidas.');
  }

  if (from > to) {
    throw new StatisticsFilterError('La fecha inicial no puede ser posterior a la fecha final.');
  }

  if (to > today) {
    throw new StatisticsFilterError('La fecha final no puede ser posterior a hoy.');
  }

  const resolved = { from: toIsoDate(from), to: toIsoDate(to) };

  if (daysBetween(resolved) > MAX_RANGE_DAYS) {
    throw new StatisticsFilterError(`El rango no puede superar ${MAX_RANGE_DAYS} días.`);
  }

  return resolved;
}
