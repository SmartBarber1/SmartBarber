import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { DemandCell } from '../../domain/models/statistics.model';
import {
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  formatHour,
  formatInteger
} from '../../utils/statistics-format';

/** Rampa secuencial de un solo tono (latón), de menor a mayor demanda. */
export const DEMAND_RAMP = ['#33291f', '#56422e', '#836540', '#b48a55', '#e2bd85'];

@Component({
  selector: 'app-demand-heatmap',
  standalone: true,
  templateUrl: './demand-heatmap.component.html',
  styleUrl: './demand-heatmap.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemandHeatmapComponent {
  readonly cells = input.required<DemandCell[]>();

  readonly activeCell = signal<DemandCell | null>(null);

  readonly ramp = DEMAND_RAMP;

  readonly hours = computed(() => [...new Set(this.cells().map(cell => cell.hour))].sort((a, b) => a - b));

  readonly rows = computed(() => {
    const weekdays = [...new Set(this.cells().map(cell => cell.weekday))].sort((a, b) => a - b);

    return weekdays.map(weekday => ({
      weekday,
      label: WEEKDAY_SHORT[weekday],
      cells: this.hours().map(hour =>
        this.cells().find(cell => cell.weekday === weekday && cell.hour === hour) ??
        { weekday, hour, reservations: 0 }
      )
    }));
  });

  private readonly max = computed(() => Math.max(0, ...this.cells().map(cell => cell.reservations)));

  readonly formatHour = formatHour;

  color(cell: DemandCell): string {
    const max = this.max();

    if (!max || !cell.reservations) {
      return 'transparent';
    }

    const level = Math.min(this.ramp.length - 1, Math.floor((cell.reservations / max) * this.ramp.length));

    return this.ramp[level];
  }

  describe(cell: DemandCell): string {
    return `${WEEKDAY_LONG[cell.weekday]} ${formatHour(cell.hour)}: ${formatInteger(cell.reservations)} reservas`;
  }
}
