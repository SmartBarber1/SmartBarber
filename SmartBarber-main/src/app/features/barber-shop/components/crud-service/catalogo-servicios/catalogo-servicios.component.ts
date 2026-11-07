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

  @Output() editar = new EventEmitter<BarberServicePayload>();
  @Output() alternarEstado = new EventEmitter<BarberServicePayload>();
  @Output() eliminar = new EventEmitter<BarberServicePayload>();
}
