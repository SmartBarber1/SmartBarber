import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Barbero } from '../../../models/reservation.model';

@Component({
  selector: 'app-barbero-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './barbero-list.component.html',
  styleUrls: ['./barbero-list.component.css']
})
export class BarberoListComponent {
  @Input() barberos: Barbero[] = [];
  @Input() selected: Barbero | null = null;
  /** Solo se puede usar el barbero elegido (al reprogramar una cita). */
  @Input() locked = false;
  /** Consultando los barberos de la barbería. */
  @Input() loading = false;
  /** Motivo por el que no se pudieron consultar (null si no hubo error). */
  @Input() error: string | null = null;
  @Output() barberoSeleccionado = new EventEmitter<Barbero>();
  @Output() reintentar = new EventEmitter<void>();
}
