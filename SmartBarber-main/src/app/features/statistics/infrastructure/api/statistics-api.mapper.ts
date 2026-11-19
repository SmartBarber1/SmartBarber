import { buildStatisticsKpis, StatisticsTotals } from '../../domain/models/statistics-kpis';
import { parseIsoDate } from '../../domain/models/statistics-period';
import {
  BarberOccupancy,
  BarberPerformance,
  BarberRevenue,
  CustomerBehavior,
  DemandCell,
  PeakSlot,
  RevenuePoint,
  ServiceRevenue,
  StatisticsDashboard,
  VirtualQueueMetrics
} from '../../domain/models/statistics.model';

/** Respuesta de GET /statistics-service/dashboard (StatisticsDashboardRsDto). */
export interface StatisticsDashboardResponse {
  barbershopId: string;
  range: { from: string; to: string };
  generatedAt: string;
  current: StatisticsTotals;
  previous: StatisticsTotals | null;
  revenueByDay: RevenuePointResponse[];
  revenueByMonth: RevenuePointResponse[];
  revenueByService: (Omit<ServiceRevenue, 'serviceId'> & { serviceId: number | string })[];
  revenueByBarber: BarberRevenue[];
  occupancyByBarber: BarberOccupancy[];
  demand: DemandCell[];
  peakSlots: PeakSlot[];
  barberPerformance: BarberPerformance[];
  customerBehavior: CustomerBehavior;
  virtualQueue: VirtualQueueMetrics;
}

/** `key`: fecha `YYYY-MM-DD` o mes `YYYY-MM`. */
interface RevenuePointResponse {
  key: string;
  revenue: number;
  services: number;
}

const DAY_LABEL = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' });

const MONTH_LABEL = new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric' });

/**
 * Convierte la respuesta del backend en el modelo del tablero. Aquí se agregan
 * los textos (etiquetas de fechas e indicadores), que son responsabilidad del front.
 */
export function mapStatisticsDashboard(response: StatisticsDashboardResponse): StatisticsDashboard {
  return {
    barbershopId: response.barbershopId,
    range: response.range,
    generatedAt: response.generatedAt,
    isSample: false,
    kpis: buildStatisticsKpis(response.current, response.previous),
    revenueByDay: (response.revenueByDay ?? []).map(point => toRevenuePoint(point, dayLabel)),
    revenueByMonth: (response.revenueByMonth ?? []).map(point => toRevenuePoint(point, monthLabel)),
    revenueByService: (response.revenueByService ?? []).map(service => ({
      ...service,
      serviceId: String(service.serviceId)
    })),
    revenueByBarber: response.revenueByBarber ?? [],
    occupancyByBarber: response.occupancyByBarber ?? [],
    demand: response.demand ?? [],
    peakSlots: response.peakSlots ?? [],
    barberPerformance: response.barberPerformance ?? [],
    customerBehavior: response.customerBehavior,
    virtualQueue: {
      ...response.virtualQueue,
      waitByHour: response.virtualQueue?.waitByHour ?? []
    }
  };
}

function toRevenuePoint(point: RevenuePointResponse, label: (key: string) => string): RevenuePoint {
  return {
    key: point.key,
    label: label(point.key),
    revenue: point.revenue,
    services: point.services
  };
}

function dayLabel(key: string): string {
  const date = parseIsoDate(key);

  return date ? DAY_LABEL.format(date) : key;
}

function monthLabel(key: string): string {
  const date = parseIsoDate(`${key}-01`);

  return date ? MONTH_LABEL.format(date) : key;
}
