import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BarberServicePayload } from '../models/servicio.model';
import { ServicioCardComponent } from '../servicio-card/servicio-card.component';

@Component({
  selector: 'app-catalogo-servicios',
  standalone: true,
  imports: [CommonModule, ServicioCardComponent],
  templateUrl: './catalogo-servicios.component.html',
  styleUrls: ['./catalogo-servicios.component.css']
})
export class CatalogoServiciosComponent {
    @Input() servicios: BarberServicePayload[] = [];
  @Input() cargando = false;
  /** Servicio con una acción en curso (activar, desactivar o eliminar). */
  @Input() ocupadoId: number | string | null | undefined = null;

  trackById(_: number, item: BarberServicePayload): unknown {
    return item.id ?? item.name;
  }

  @Output() editar = new EventEmitter<BarberServicePayload>();
  @Output() alternarEstado = new EventEmitter<BarberServicePayload>();
  @Output() eliminar = new EventEmitter<BarberServicePayload>();
}
