import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PENALTY_STATE_LABELS, PenaltyStanding } from '../../domain/models/penalty.model';

/**
 * Estado del cliente en cada barbería donde tiene inasistencias vigentes o
 * una restricción (RF-85): cuántas lleva, cuándo deja de contar cada una y,
 * si aplica, hasta cuándo no puede reservar. Solo presentación.
 */
@Component({
  selector: 'app-penalty-status',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './penalty-status.component.html',
  styleUrl: './penalty-status.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PenaltyStatusComponent {
  @Input() standings: PenaltyStanding[] = [];

  readonly labels = PENALTY_STATE_LABELS;

  trackByShop(_: number, standing: PenaltyStanding): string {
    return standing.barbershopId;
  }
}
