import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';

import {
  addDays,
  daysBetween,
  parseIsoDate,
  previousRange,
  toIsoDate
} from '../../domain/models/statistics-period';
import {
  BarberOccupancy,
  BarberPerformance,
  DemandCell,
  RevenuePoint,
  StatisticsDashboard,
  StatisticsDateRange,
  StatisticsKpi
} from '../../domain/models/statistics.model';
import { StatisticsRepository } from '../../domain/repositories/statistics.repository';

import {
  CLOSING_HOUR,
  MOCK_BARBERS,
  MOCK_SERVICES,
  MockReservation,
  OPENING_HOUR,
  WORKDAY_MINUTES,
  getMockReservations
} from './statistics-mock.data';

/** Latencia simulada para poder ver el estado de carga. */
const MOCK_LATENCY_MS = 350;

const SERVICE_BY_ID = new Map(MOCK_SERVICES.map(service => [service.id, service]));

interface PeriodTotals {
  revenue: number;
  completed: number;
  occupancy: number;
  effectiveRate: number | null;
  averageWait: number | null;
}

/**
 * Adaptador con datos quemados. Hace la agregación que en producción hará el
 * backend; para conectar el API basta con registrar otro `StatisticsRepository`
 * en `statistics.routes.ts`.
 */
@Injectable()
export class StatisticsMockRepository extends StatisticsRepository {

  override getDashboard(
    barbershopId: string,
    range: StatisticsDateRange
  ): Observable<StatisticsDashboard> {
    if (!barbershopId) {
      return throwError(() => new Error('Barbería no identificada.'));
    }

    const today = new Date();
    const all = getMockReservations(barbershopId, today);
    const current = inRange(all, range);
    const previous = previousRange(range);
    const previousRecords = inRange(all, previous);

    return of(this.buildDashboard(barbershopId, range, current, previous, previousRecords))
      .pipe(delay(MOCK_LATENCY_MS));
  }

  private buildDashboard(
    barbershopId: string,
    range: StatisticsDateRange,
    records: MockReservation[],
    previous: StatisticsDateRange,
    previousRecords: MockReservation[]
  ): StatisticsDashboard {
    // Solo los servicios finalizados generan ingreso operacional.
    const completed = records.filter(r => r.status === 'COMPLETED');
    const scheduled = records.filter(r => r.type === 'SERVICE_RESERVATION');
    const queue = records.filter(r => r.type === 'VIRTUAL_QUEUE');
    const workingDays = countWorkingDays(range);
    const occupancyByBarber = buildOccupancy(completed, workingDays);
    const waits = queue.map(r => r.waitMinutes ?? 0);

    const totals = periodTotals(records, workingDays);
    const previousTotals = previousRecords.length
      ? periodTotals(previousRecords, countWorkingDays(previous))
      : null;

    const demand = buildDemand(records);

    return {
      barbershopId,
      range,
      generatedAt: new Date().toISOString(),
      isSample: true,
      kpis: buildKpis(totals, previousTotals),
      revenueByDay: buildRevenueByDay(completed, range),
      revenueByMonth: buildRevenueByMonth(completed, range),
      revenueByService: MOCK_SERVICES
        .map(service => {
          const items = completed.filter(r => r.serviceIds.includes(service.id));

          return {
            serviceId: service.id,
            name: service.name,
            count: items.length,
            revenue: items.length * service.price
          };
        })
        .sort((a, b) => b.count - a.count),
      revenueByBarber: MOCK_BARBERS
        .map(barber => {
          const items = completed.filter(r => r.barberId === barber.id);

          return {
            barberId: barber.id,
            name: barber.name,
            count: items.length,
            revenue: sum(items, r => r.revenue)
          };
        })
        .sort((a, b) => b.revenue - a.revenue),
      occupancyByBarber,
      demand,
      peakSlots: [...demand]
        .filter(cell => cell.reservations > 0)
        .sort((a, b) => b.reservations - a.reservations)
        .slice(0, 5),
      barberPerformance: buildPerformance(completed),
      customerBehavior: {
        total: scheduled.length,
        effective: scheduled.filter(r => r.status === 'COMPLETED').length,
        cancelled: scheduled.filter(r => r.status === 'CANCELLED').length,
        noShow: scheduled.filter(r => r.status === 'NO_SHOW').length
      },
      virtualQueue: {
        turnsServed: queue.length,
        freedSlots: scheduled.filter(r => r.status !== 'COMPLETED').length,
        recoveredSlots: queue.filter(r => r.recoveredSlot).length,
        averageWaitMinutes: average(waits) ?? 0,
        waitByHour: hours().map(hour => {
          const turns = queue.filter(r => r.hour === hour);

          return {
            hour,
            turns: turns.length,
            averageWaitMinutes: average(turns.map(r => r.waitMinutes ?? 0)) ?? 0
          };
        })
      }
    };
  }
}

function inRange(records: MockReservation[], range: StatisticsDateRange): MockReservation[] {
  return records.filter(r => r.date >= range.from && r.date <= range.to);
}

function periodTotals(records: MockReservation[], workingDays: number): PeriodTotals {
  const completed = records.filter(r => r.status === 'COMPLETED');
  const scheduled = records.filter(r => r.type === 'SERVICE_RESERVATION');
  const available = workingDays * WORKDAY_MINUTES * MOCK_BARBERS.length;

  return {
    revenue: sum(completed, r => r.revenue),
    completed: completed.length,
    occupancy: available ? sum(completed, r => r.durationMinutes) / available : 0,
    effectiveRate: scheduled.length
      ? scheduled.filter(r => r.status === 'COMPLETED').length / scheduled.length
      : null,
    averageWait: average(
      records.filter(r => r.type === 'VIRTUAL_QUEUE').map(r => r.waitMinutes ?? 0)
    )
  };
}

function buildKpis(current: PeriodTotals, previous: PeriodTotals | null): StatisticsKpi[] {
  const ticket = (totals: PeriodTotals) => totals.completed ? totals.revenue / totals.completed : 0;

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

function buildOccupancy(completed: MockReservation[], workingDays: number): BarberOccupancy[] {
  const availableMinutes = workingDays * WORKDAY_MINUTES;

  return MOCK_BARBERS
    .map(barber => {
      const bookedMinutes = sum(completed.filter(r => r.barberId === barber.id), r => r.durationMinutes);

      return {
        barberId: barber.id,
        name: barber.name,
        bookedMinutes,
        availableMinutes,
        occupancy: availableMinutes ? Math.min(1, bookedMinutes / availableMinutes) : 0
      };
    })
    .sort((a, b) => b.occupancy - a.occupancy);
}

function buildDemand(records: MockReservation[]): DemandCell[] {
  const cells: DemandCell[] = [];

  for (let weekday = 1; weekday <= 7; weekday++) {
    for (const hour of hours()) {
      cells.push({
        weekday,
        hour,
        reservations: records.filter(r => r.weekday === weekday && r.hour === hour).length
      });
    }
  }

  return cells;
}

function buildPerformance(completed: MockReservation[]): BarberPerformance[] {
  return MOCK_BARBERS
    .map(barber => {
      const items = completed.filter(r => r.barberId === barber.id);
      const ratings = items.filter(r => r.rating !== null).map(r => r.rating as number);

      return {
        barberId: barber.id,
        name: barber.name,
        customersServed: new Set(items.map(r => r.customerId)).size,
        servicesCompleted: items.length,
        revenue: sum(items, r => r.revenue),
        rating: average(ratings),
        ratingCount: ratings.length,
        averageMinutes: average(items.map(r => r.durationMinutes)) ?? 0
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

function buildRevenueByDay(completed: MockReservation[], range: StatisticsDateRange): RevenuePoint[] {
  const points: RevenuePoint[] = [];
  const dayFormat = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' });
  const end = parseIsoDate(range.to) as Date;

  for (let day = parseIsoDate(range.from) as Date; day <= end; day = addDays(day, 1)) {
    const key = toIsoDate(day);
    const items = completed.filter(r => r.date === key);

    points.push({
      key,
      label: dayFormat.format(day),
      revenue: sum(items, r => r.revenue),
      services: items.length
    });
  }

  return points;
}

function buildRevenueByMonth(completed: MockReservation[], range: StatisticsDateRange): RevenuePoint[] {
  const monthFormat = new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric' });
  const from = parseIsoDate(range.from) as Date;
  const to = parseIsoDate(range.to) as Date;
  const points: RevenuePoint[] = [];

  for (
    let month = new Date(from.getFullYear(), from.getMonth(), 1);
    month <= to;
    month = new Date(month.getFullYear(), month.getMonth() + 1, 1)
  ) {
    const key = toIsoDate(month).slice(0, 7);
    const items = completed.filter(r => r.date.startsWith(key));

    points.push({
      key,
      label: monthFormat.format(month),
      revenue: sum(items, r => r.revenue),
      services: items.length
    });
  }

  return points;
}

/** La barbería de demostración atiende todos los días. */
function countWorkingDays(range: StatisticsDateRange): number {
  return daysBetween(range);
}

function hours(): number[] {
  return Array.from({ length: CLOSING_HOUR - OPENING_HOUR }, (_, index) => OPENING_HOUR + index);
}

function sum<T>(items: T[], valueOf: (item: T) => number): number {
  return items.reduce((total, item) => total + valueOf(item), 0);
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}
