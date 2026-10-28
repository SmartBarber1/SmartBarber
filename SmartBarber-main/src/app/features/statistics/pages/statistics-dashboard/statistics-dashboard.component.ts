import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, catchError, map, of, switchMap, tap } from 'rxjs';

import { GetStatisticsDashboardUseCase } from '../../application/use-cases/get-statistics-dashboard.use-case';
import { DemandHeatmapComponent } from '../../components/demand-heatmap/demand-heatmap.component';
import { RankedBarItem, RankedBarsComponent } from '../../components/ranked-bars/ranked-bars.component';
import { RevenueTrendChartComponent } from '../../components/revenue-trend-chart/revenue-trend-chart.component';
import {
  StatisticsAccessError,
  StatisticsFilterError
} from '../../domain/errors/statistics.errors';
import {
  MAX_RANGE_DAYS,
  addDays,
  daysBetween,
  parseIsoDate,
  toIsoDate
} from '../../domain/models/statistics-period';
import {
  RevenueGranularity,
  StatisticsDashboard,
  StatisticsFilter,
  StatisticsKpi,
  StatisticsPeriod
} from '../../domain/models/statistics.model';
import {
  WEEKDAY_LONG,
  formatCurrency,
  formatHour,
  formatInteger,
  formatKpi,
  formatMinutes,
  formatPercent,
  formatRating
} from '../../utils/statistics-format';

type RevenueBreakdown = 'SERVICE' | 'BARBER';

type LoadResult =
  | { dashboard: StatisticsDashboard }
  | { error: unknown };

interface KpiDelta {
  label: string;
  direction: 'up' | 'down' | 'flat';
  favorable: boolean;
}

/** Granularidad diaria por defecto hasta dos meses; luego mensual. */
const DAILY_GRANULARITY_MAX_DAYS = 62;

@Component({
  selector: 'app-statistics-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RevenueTrendChartComponent,
    RankedBarsComponent,
    DemandHeatmapComponent
  ],
  templateUrl: './statistics-dashboard.component.html',
  styleUrl: './statistics-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatisticsDashboardComponent {

  private readonly getDashboard = inject(GetStatisticsDashboardUseCase);

  private readonly requests = new Subject<StatisticsFilter>();

  readonly periods: { id: StatisticsPeriod; label: string }[] = [
    { id: 'DAY', label: 'Hoy' },
    { id: 'WEEK', label: 'Últimos 7 días' },
    { id: 'MONTH', label: 'Este mes' },
    { id: 'RANGE', label: 'Rango de fechas' }
  ];

  readonly maxRangeDays = MAX_RANGE_DAYS;

  readonly today = toIsoDate(new Date());

  readonly period = signal<StatisticsPeriod>('MONTH');

  readonly customFrom = signal(toIsoDate(addDays(new Date(), -29)));

  readonly customTo = signal(this.today);

  readonly rangeError = signal<string | null>(null);

  readonly loading = signal(true);

  readonly errorMessage = signal<string | null>(null);

  readonly dashboard = signal<StatisticsDashboard | null>(null);

  readonly granularity = signal<RevenueGranularity>('DAY');

  readonly breakdown = signal<RevenueBreakdown>('SERVICE');

  readonly rangeLabel = computed(() => {
    const data = this.dashboard();

    if (!data) {
      return '';
    }

    const format = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
    const from = format.format(parseIsoDate(data.range.from) as Date);
    const to = format.format(parseIsoDate(data.range.to) as Date);
    const days = daysBetween(data.range);

    return from === to ? from : `${from} – ${to} · ${days} días`;
  });

  readonly trendPoints = computed(() => {
    const data = this.dashboard();

    if (!data) {
      return [];
    }

    return this.granularity() === 'DAY' ? data.revenueByDay : data.revenueByMonth;
  });

  readonly breakdownItems = computed<RankedBarItem[]>(() => {
    const data = this.dashboard();

    if (!data) {
      return [];
    }

    const source = this.breakdown() === 'SERVICE'
      ? data.revenueByService.map(item => ({ id: item.serviceId, name: item.name, count: item.count, revenue: item.revenue }))
      : data.revenueByBarber.map(item => ({ id: item.barberId, name: item.name, count: item.count, revenue: item.revenue }));

    const total = source.reduce((sum, item) => sum + item.revenue, 0);

    return [...source]
      .sort((a, b) => b.revenue - a.revenue)
      .map(item => ({
        id: item.id,
        label: item.name,
        value: item.revenue,
        valueLabel: formatCurrency(item.revenue),
        detail: `${formatInteger(item.count)} servicios · ${formatPercent(total ? item.revenue / total : 0)} del total`
      }));
  });

  readonly topServiceItems = computed<RankedBarItem[]>(() =>
    (this.dashboard()?.revenueByService ?? []).map(item => ({
      id: item.serviceId,
      label: item.name,
      value: item.count,
      valueLabel: `${formatInteger(item.count)} solicitudes`
    }))
  );

  readonly occupancyItems = computed<RankedBarItem[]>(() =>
    (this.dashboard()?.occupancyByBarber ?? []).map(item => ({
      id: item.barberId,
      label: item.name,
      value: item.occupancy,
      valueLabel: formatPercent(item.occupancy),
      detail: `${formatInteger(Math.round(item.bookedMinutes / 60))} h atendidas de ${formatInteger(Math.round(item.availableMinutes / 60))} h disponibles`
    }))
  );

  readonly peakSlots = computed(() =>
    (this.dashboard()?.peakSlots ?? []).map(slot => ({
      key: `${slot.weekday}-${slot.hour}`,
      label: `${WEEKDAY_LONG[slot.weekday]} · ${formatHour(slot.hour)} – ${formatHour(slot.hour + 1)}`,
      reservations: formatInteger(slot.reservations)
    }))
  );

  readonly behaviorSegments = computed(() => {
    const behavior = this.dashboard()?.customerBehavior;

    if (!behavior || !behavior.total) {
      return [];
    }

    return [
      { id: 'effective', label: 'Efectivas', value: behavior.effective },
      { id: 'cancelled', label: 'Canceladas', value: behavior.cancelled },
      { id: 'no-show', label: 'Inasistencias', value: behavior.noShow }
    ].map(segment => ({
      ...segment,
      share: segment.value / behavior.total,
      shareLabel: formatPercent(segment.value / behavior.total),
      valueLabel: formatInteger(segment.value)
    }));
  });

  readonly queueWaitItems = computed<RankedBarItem[]>(() =>
    (this.dashboard()?.virtualQueue.waitByHour ?? [])
      .filter(item => item.turns > 0)
      .map(item => ({
        id: String(item.hour),
        label: `${formatHour(item.hour)} – ${formatHour(item.hour + 1)}`,
        value: item.averageWaitMinutes,
        valueLabel: formatMinutes(item.averageWaitMinutes),
        detail: `${formatInteger(item.turns)} turnos`
      }))
  );

  readonly recoveryRate = computed(() => {
    const queue = this.dashboard()?.virtualQueue;

    return queue && queue.freedSlots ? queue.recoveredSlots / queue.freedSlots : 0;
  });

  readonly formatCurrency = formatCurrency;

  readonly formatInteger = formatInteger;

  readonly formatMinutes = formatMinutes;

  readonly formatPercent = formatPercent;

  readonly formatRating = formatRating;

  constructor() {
    this.requests
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.errorMessage.set(null);
          this.rangeError.set(null);
        }),
        // switchMap descarta respuestas de filtros anteriores si el usuario cambia rápido.
        switchMap(filter =>
          this.getDashboard.execute(filter).pipe(
            map((dashboard): LoadResult => ({ dashboard })),
            catchError(error => of<LoadResult>({ error }))
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe(result => {
        this.loading.set(false);

        if ('dashboard' in result) {
          this.dashboard.set(result.dashboard);
          this.granularity.set(
            daysBetween(result.dashboard.range) <= DAILY_GRANULARITY_MAX_DAYS ? 'DAY' : 'MONTH'
          );
          return;
        }

        this.handleError(result.error);
      });

    this.load();
  }

  selectPeriod(period: StatisticsPeriod): void {
    this.period.set(period);
    this.rangeError.set(null);

    if (period !== 'RANGE') {
      this.load();
    }
  }

  applyRange(): void {
    this.load();
  }

  load(): void {
    const period = this.period();

    this.requests.next(
      period === 'RANGE'
        ? { period, customRange: { from: this.customFrom(), to: this.customTo() } }
        : { period }
    );
  }

  formatKpiValue(kpi: StatisticsKpi): string {
    return formatKpi(kpi.value, kpi.format);
  }

  /** Variación frente al periodo anterior: puntos porcentuales para tasas, % relativo para el resto. */
  kpiDelta(kpi: StatisticsKpi): KpiDelta | null {
    if (kpi.previous === null) {
      return null;
    }

    const isRate = kpi.format === 'percent';

    if (!isRate && kpi.previous === 0) {
      return null;
    }

    const change = isRate
      ? (kpi.value - kpi.previous) * 100
      : ((kpi.value - kpi.previous) / kpi.previous) * 100;

    const rounded = Math.round(change * 10) / 10;
    const direction = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat';
    const sign = rounded > 0 ? '+' : '';
    const number = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(rounded);

    return {
      label: `${sign}${number} ${isRate ? 'pp' : '%'}`,
      direction,
      favorable: direction === 'flat' || (direction === 'down') === !!kpi.lowerIsBetter
    };
  }

  private handleError(error: unknown): void {
    if (error instanceof StatisticsFilterError) {
      this.rangeError.set(error.message);
      return;
    }

    // No se exponen detalles técnicos del error al usuario.
    this.errorMessage.set(
      error instanceof StatisticsAccessError
        ? error.message
        : 'No se pudieron cargar las estadísticas. Intenta de nuevo en unos minutos.'
    );
  }
}
