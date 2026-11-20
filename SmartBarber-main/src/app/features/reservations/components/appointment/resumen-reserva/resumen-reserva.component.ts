import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Servicio } from '../../../models/reservation.model';

@Component({
  selector: 'app-resumen-reserva',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './resumen-reserva.component.html',
  styleUrls: ['./resumen-reserva.component.css']
})
export class ResumenReservaComponent {
  @Input() servicios: Servicio[] = [];
  @Input() total: number = 0;
  @Input() duracion: number = 30;
  @Input() cargando: boolean = false;
  /** Falta elegir servicio, barbero u hora: el botón queda deshabilitado. */
  @Input() incompleto: boolean = false;
  /** Texto del botón (por ejemplo, "Confirmar nueva hora" al reprogramar). */
  @Input() etiqueta: string = 'Confirmar Reserva';
  @Output() confirmar = new EventEmitter<void>();
}
