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

  /** Clientes en espera: sin clientes no se puede llamar al siguiente. */
  @Input()
  waitingCount = 0;

  /** Se puede llamar al siguiente: hay clientes y no hay un turno en atención. */
  get canCallNext(): boolean {
    return this.waitingCount > 0 && !this.hasCurrentTurn;
  }

  get nextHint(): string {
    if (this.hasCurrentTurn) return 'Finaliza el turno actual antes de llamar al siguiente.';
    if (this.waitingCount === 0) return 'No hay clientes en espera.';
    return '';
  }

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