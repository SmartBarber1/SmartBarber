import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';

@Component({
  selector: 'app-queue-header',
  standalone: true,
  templateUrl: './queue-header.component.html',
  styleUrls: ['./queue-header.component.css']
})
export class QueueHeaderComponent {

  @Input()
  loading = false;

  @Input()
  actionLoading = false;

  @Output()
  refresh = new EventEmitter<void>();

  onRefresh(): void {
    this.refresh.emit();
  }

}