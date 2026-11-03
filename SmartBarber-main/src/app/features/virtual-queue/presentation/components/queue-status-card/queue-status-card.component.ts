import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';

@Component({
  selector: 'app-queue-status-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './queue-status-card.component.html',
  styleUrl: './queue-status-card.component.css'
})
export class QueueStatusCardComponent {

  @Input()
  actionLoading = false;

  @Output()
  openQueue = new EventEmitter<void>();

  onOpenQueue(): void {
    this.openQueue.emit();
  }

}