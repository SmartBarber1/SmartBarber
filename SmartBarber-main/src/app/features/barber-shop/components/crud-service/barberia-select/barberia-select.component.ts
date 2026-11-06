import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BarberiaOpcion } from '../models/servicio.model';

@Component({
  selector: 'app-barberia-select',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './barberia-select.component.html',
  styleUrls: ['./barberia-select.component.css']
})
export class BarberiaSelectComponent {
  @Input() barberias: BarberiaOpcion[] = [];
  @Input() selectedId: string = '';
  @Output() barberiaSeleccionada = new EventEmitter<string>();

  onChange(event: Event): void {
    this.barberiaSeleccionada.emit((event.target as HTMLSelectElement).value);
  }
}
