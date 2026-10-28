/**
 * Modelos del dashboard de estadísticas (RF-67, RF-68, RF-70 y OE-04).
 * Los ingresos operacionales solo consideran servicios finalizados (COMPLETED).
 */

export type StatisticsPeriod = 'DAY' | 'WEEK' | 'MONTH' | 'RANGE';

export type RevenueGranularity = 'DAY' | 'MONTH';

/** Rango cerrado de fechas en formato ISO `YYYY-MM-DD`. */
export interface StatisticsDateRange {
  from: string;
  to: string;
}

export interface StatisticsFilter {
  period: StatisticsPeriod;
  customRange?: StatisticsDateRange;
}

export type KpiFormat = 'currency' | 'number' | 'percent' | 'minutes' | 'rating';

export interface StatisticsKpi {
  id: string;
  label: string;
  value: number;
  /** Valor del periodo anterior de igual duración; `null` si no hay datos. */
  previous: number | null;
  format: KpiFormat;
  hint: string;
  /** Indica si una variación negativa es favorable (por ejemplo, la espera). */
  lowerIsBetter?: boolean;
}

export interface RevenuePoint {
  key: string;
  label: string;
  revenue: number;
  services: number;
}

export interface ServiceRevenue {
  serviceId: string;
  name: string;
  count: number;
  revenue: number;
}

export interface BarberRevenue {
  barberId: string;
  name: string;
  count: number;
  revenue: number;
}

export interface BarberOccupancy {
  barberId: string;
  name: string;
  bookedMinutes: number;
  availableMinutes: number;
  /** Valor entre 0 y 1. */
  occupancy: number;
}

/** Celda del mapa de demanda: día de la semana (1 = lunes) y hora de inicio. */
export interface DemandCell {
  weekday: number;
  hour: number;
  reservations: number;
}

export interface PeakSlot {
  weekday: number;
  hour: number;
  reservations: number;
}

export interface BarberPerformance {
  barberId: string;
  name: string;
  customersServed: number;
  servicesCompleted: number;
  revenue: number;
  rating: number | null;
  ratingCount: number;
  averageMinutes: number;
}

export interface CustomerBehavior {
  total: number;
  effective: number;
  cancelled: number;
  noShow: number;
}

export interface VirtualQueueMetrics {
  turnsServed: number;
  freedSlots: number;
  recoveredSlots: number;
  averageWaitMinutes: number;
  waitByHour: { hour: number; averageWaitMinutes: number; turns: number }[];
}

export interface StatisticsDashboard {
  barbershopId: string;
  range: StatisticsDateRange;
  generatedAt: string;
  /** `true` cuando la información proviene de datos de demostración. */
  isSample: boolean;
  kpis: StatisticsKpi[];
  revenueByDay: RevenuePoint[];
  revenueByMonth: RevenuePoint[];
  revenueByService: ServiceRevenue[];
  revenueByBarber: BarberRevenue[];
  occupancyByBarber: BarberOccupancy[];
  demand: DemandCell[];
  peakSlots: PeakSlot[];
  barberPerformance: BarberPerformance[];
  customerBehavior: CustomerBehavior;
  virtualQueue: VirtualQueueMetrics;
}
