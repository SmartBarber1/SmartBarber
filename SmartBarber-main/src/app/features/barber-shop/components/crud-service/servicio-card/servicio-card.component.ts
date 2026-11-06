import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BarberServicePayload } from '../models/servicio.model';

@Component({
  selector: 'app-servicio-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './servicio-card.component.html',
  styleUrls: ['./servicio-card.component.css']
})
export class ServicioCardComponent {
  @Input({ required: true }) servicio!: BarberServicePayload;

  @Output() editar = new EventEmitter<void>();
  @Output() alternarEstado = new EventEmitter<void>();
  @Output() eliminar = new EventEmitter<void>();
}
