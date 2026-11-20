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

  /** Días del mes visible anteriores a hoy (no se pueden reservar). */
  diasPasados: ReadonlySet<number> = new Set<number>();

  /** El mes visible es el actual: no se puede retroceder a meses pasados. */
  esMesActual = true;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentDate']) {
      this.mes = construirMes(this.currentDate);
      this.calcularDiasPasados();
    }
  }

  private calcularDiasPasados(): void {
    const hoy = new Date();
    const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    this.diasPasados = new Set(
      this.mes.dias.filter(d => new Date(year, month, d).getTime() < inicioHoy)
    );
    this.esMesActual = year < hoy.getFullYear()
      || (year === hoy.getFullYear() && month <= hoy.getMonth());
  }
}
