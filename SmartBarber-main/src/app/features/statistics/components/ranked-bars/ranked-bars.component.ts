import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface RankedBarItem {
  id: string;
  label: string;
  value: number;
  valueLabel: string;
  detail?: string;
}

@Component({
  selector: 'app-ranked-bars',
  standalone: true,
  templateUrl: './ranked-bars.component.html',
  styleUrl: './ranked-bars.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RankedBarsComponent {
  readonly items = input.required<RankedBarItem[]>();

  /** Escala fija opcional (por ejemplo, 1 para porcentajes); si no, el mayor valor. */
  readonly scaleMax = input<number | null>(null);

  readonly emptyMessage = input('Sin datos en este periodo.');

  private readonly max = computed(() =>
    this.scaleMax() ?? Math.max(0, ...this.items().map(item => item.value))
  );

  readonly hasData = computed(() => this.items().some(item => item.value > 0));

  width(item: RankedBarItem): number {
    const max = this.max();

    return max > 0 ? Math.min(100, (item.value / max) * 100) : 0;
  }
}
