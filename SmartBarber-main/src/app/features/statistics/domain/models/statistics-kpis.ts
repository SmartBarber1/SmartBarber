import { StatisticsKpi } from './statistics.model';

/** Totales de un periodo con los que se arman los indicadores principales. */
export interface StatisticsTotals {
  revenue: number;
  completed: number;
  /** Minutos atendidos / minutos disponibles (0 a 1). */
  occupancy: number;
  /** `null` si no hubo reservas agendadas cerradas. */
  effectiveRate: number | null;
  /** Minutos; `null` si no hubo turnos de cola atendidos. */
  averageWait: number | null;
}

/**
 * Indicadores del tablero con sus textos. `previous` es el periodo anterior de
 * igual duración; si es `null`, los indicadores no muestran variación.
 */
export function buildStatisticsKpis(
  current: StatisticsTotals,
  previous: StatisticsTotals | null
): StatisticsKpi[] {
  const ticket = (totals: StatisticsTotals) => totals.completed ? totals.revenue / totals.completed : 0;

  return [
    {
      id: 'revenue',
      label: 'Ingresos operacionales',
      value: current.revenue,
      previous: previous?.revenue ?? null,
      format: 'currency',
      hint: 'Solo servicios finalizados'
    },
    {
      id: 'completed',
      label: 'Servicios finalizados',
      value: current.completed,
      previous: previous?.completed ?? null,
      format: 'number',
      hint: 'Reservas y turnos de cola'
    },
    {
      id: 'ticket',
      label: 'Ticket promedio',
      value: ticket(current),
      previous: previous ? ticket(previous) : null,
      format: 'currency',
      hint: 'Ingreso por servicio finalizado'
    },
    {
      id: 'occupancy',
      label: 'Ocupación promedio',
      value: current.occupancy,
      previous: previous?.occupancy ?? null,
      format: 'percent',
      hint: 'Minutos atendidos / disponibles'
    },
    {
      id: 'effective-rate',
      label: 'Reservas efectivas',
      value: current.effectiveRate ?? 0,
      previous: previous?.effectiveRate ?? null,
      format: 'percent',
      hint: 'Sin cancelaciones ni inasistencias'
    },
    {
      id: 'queue-wait',
      label: 'Espera promedio en cola',
      value: current.averageWait ?? 0,
      previous: previous?.averageWait ?? null,
      format: 'minutes',
      hint: 'Desde el ingreso hasta la atención',
      lowerIsBetter: true
    }
  ];
}
