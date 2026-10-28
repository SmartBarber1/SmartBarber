import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { RevenuePoint } from '../../domain/models/statistics.model';
import {
  formatCompactCurrency,
  formatCurrency,
  formatInteger,
  niceMax
} from '../../utils/statistics-format';

const MAX_AXIS_LABELS = 7;

@Component({
  selector: 'app-revenue-trend-chart',
  standalone: true,
  templateUrl: './revenue-trend-chart.component.html',
  styleUrl: './revenue-trend-chart.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RevenueTrendChartComponent {
  readonly points = input.required<RevenuePoint[]>();

  readonly caption = input('Ingresos');

  readonly activeIndex = signal<number | null>(null);

  readonly axisMax = computed(() => niceMax(Math.max(0, ...this.points().map(p => p.revenue))));

  readonly gridLines = computed(() => {
    const max = this.axisMax();

    return [1, 0.75, 0.5, 0.25].map(ratio => ({
      ratio,
      label: formatCompactCurrency(max * ratio)
    }));
  });

  /** Muestra un número limitado de etiquetas en el eje X para evitar choques. */
  readonly labelStep = computed(() => Math.max(1, Math.ceil(this.points().length / MAX_AXIS_LABELS)));

  readonly activePoint = computed(() => {
    const index = this.activeIndex();

    return index === null ? null : this.points()[index] ?? null;
  });

  readonly hasRevenue = computed(() => this.points().some(point => point.revenue > 0));

  readonly formatCurrency = formatCurrency;

  readonly formatInteger = formatInteger;

  barHeight(point: RevenuePoint): number {
    return (point.revenue / this.axisMax()) * 100;
  }

  /** Posición horizontal del tooltip, acotada para que no se salga del panel. */
  tooltipLeft(index: number): number {
    const position = ((index + 0.5) / this.points().length) * 100;

    return Math.min(85, Math.max(15, position));
  }

  showLabel(index: number): boolean {
    const step = this.labelStep();
    const last = this.points().length - 1;

    return index % step === 0 && (index === last || last - index >= step / 2);
  }
}
