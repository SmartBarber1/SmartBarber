import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { QueueTurn } from '../../../domain/model/queue-event.model';

@Component({
  selector: 'app-waiting-turns-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './waiting-turns-table.component.html',
  styleUrl: './waiting-turns-table.component.css'
})
export class WaitingTurnsTableComponent {

  @Input()
  waitingTurns: QueueTurn[] = [];

  @Input()
  waitingCount = 0;

}