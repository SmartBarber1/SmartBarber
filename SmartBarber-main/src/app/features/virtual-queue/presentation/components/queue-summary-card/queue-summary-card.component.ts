import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { QueueTurn } from '../../../domain/model/queue-event.model';

@Component({
  selector: 'app-queue-summary-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './queue-summary-card.component.html',
  styleUrl: './queue-summary-card.component.css'
})
export class QueueSummaryCardComponent {

  @Input()
  acceptingClients = false;

  @Input()
  waitingCount = 0;

  @Input()
  currentTurn: QueueTurn | null = null;

}