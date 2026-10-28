import { KpiFormat } from '../domain/models/statistics.model';

const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});

const compactCurrency = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  notation: 'compact',
  maximumFractionDigits: 1
});

const integer = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

const decimal = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const percent = new Intl.NumberFormat('es-CO', { style: 'percent', maximumFractionDigits: 1 });

export const WEEKDAY_SHORT = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const WEEKDAY_LONG = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function formatCurrency(value: number): string {
  return currency.format(value);
}

export function formatCompactCurrency(value: number): string {
  return compactCurrency.format(value);
}

export function formatInteger(value: number): string {
  return integer.format(value);
}

export function formatPercent(value: number): string {
  return percent.format(value);
}

export function formatMinutes(value: number): string {
  return `${integer.format(value)} min`;
}

export function formatRating(value: number | null): string {
  return value === null ? 'Sin calificaciones' : decimal.format(value);
}

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function formatKpi(value: number, format: KpiFormat): string {
  switch (format) {
    case 'currency':
      return formatCurrency(value);
    case 'percent':
      return formatPercent(value);
    case 'minutes':
      return formatMinutes(value);
    case 'rating':
      return formatRating(value);
    default:
      return formatInteger(value);
  }
}

/** Redondea el máximo del eje hacia un valor "limpio" (1, 2, 2.5, 5 × 10ⁿ). */
export function niceMax(value: number): number {
  if (value <= 0) {
    return 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find(candidate => candidate * magnitude >= value) ?? 10;

  return step * magnitude;
}
