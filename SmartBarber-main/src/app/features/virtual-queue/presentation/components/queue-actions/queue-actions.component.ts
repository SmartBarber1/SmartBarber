import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';

@Component({
  selector: 'app-queue-actions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './queue-actions.component.html',
  styleUrl: './queue-actions.component.css'
})
export class QueueActionsComponent {

  @Input()
  acceptingClients = false;

  @Input()
  actionLoading = false;

  @Input()
  hasCurrentTurn = false;

  @Output()
  openQueue = new EventEmitter<void>();

  @Output()
  nextCustomer = new EventEmitter<void>();

  @Output()
  completeTurn = new EventEmitter<void>();

  @Output()
  closeQueue = new EventEmitter<void>();

  onOpenQueue(): void {
    this.openQueue.emit();
  }

  onNextCustomer(): void {
    this.nextCustomer.emit();
  }

  onCompleteTurn(): void {
    this.completeTurn.emit();
  }

  onCloseQueue(): void {
    this.closeQueue.emit();
  }

}