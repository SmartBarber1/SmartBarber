import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Cita próxima del cliente lista para mostrar. */
export interface CitaCliente {
  id: string;
  barbershopId: string;
  employeeId: string;
  barbershopName: string;
  start: Date;
  end: Date;
  duration: number;
  status: string;
  statusLabel: string;
  services: string[];
  /** Se puede cancelar o reprogramar (respeta la anticipación de la barbería). */
  modifiable: boolean;
  /** Aún está dentro del plazo para cancelar sin que cuente como inasistencia. */
  cancelable: boolean;
  /** Aún se puede reprogramar (hasta 60 minutos antes). */
  reschedulable: boolean;
  /** Horas de anticipación para cancelar en esa barbería. */
  cancelNoticeHours: number;
}

/**
 * Lista de las próximas citas del cliente con las acciones Cancelar y
 * Reprogramar. Componente de presentación: el contenedor decide qué hacer.
 */
@Component({
  selector: 'app-mis-citas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mis-citas.component.html',
  styleUrls: ['./mis-citas.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MisCitasComponent {
  @Input() citas: CitaCliente[] = [];
  @Input() loading = false;
  @Input() error = '';
  /** Cita cuya acción se está procesando. */
  @Input() busyId: string | null = null;
  /** Cita que se está reprogramando. */
  @Input() reprogramandoId: string | null = null;

  @Output() cancelar = new EventEmitter<CitaCliente>();
  @Output() reprogramar = new EventEmitter<CitaCliente>();
  @Output() reintentar = new EventEmitter<void>();

  trackById(_: number, cita: CitaCliente): string {
    return cita.id;
  }
}
