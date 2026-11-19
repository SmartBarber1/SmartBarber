import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MesCalendario, construirMes } from '../../../utils/calendar.utils';

@Component({
  selector: 'app-calendario',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendario.component.html',
  styleUrls: ['./calendario.component.css']
})
export class CalendarioComponent implements OnChanges {
  /** Mes visible (el padre lo reemplaza por un Date nuevo al navegar) */
  @Input() currentDate: Date = new Date();
  @Input() selectedDia: number | null = null;
  /** Días del mes en que la barbería no atiende. */
  @Input() diasCerrados: ReadonlySet<number> = new Set<number>();

  /** Emite -1 (mes anterior) o +1 (mes siguiente) */
  @Output() cambioMes = new EventEmitter<number>();
  @Output() diaSeleccionado = new EventEmitter<number>();

  mes: MesCalendario = construirMes(new Date());

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentDate']) {
      this.mes = construirMes(this.currentDate);
    }
  }
}
