import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { QueueTurn } from '../../../domain/model/queue-event.model';

@Component({
  selector: 'app-current-turn-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './current-turn-card.component.html',
  styleUrl: './current-turn-card.component.css'
})
export class CurrentTurnCardComponent {

  @Input()
  currentTurn: QueueTurn | null = null;

}