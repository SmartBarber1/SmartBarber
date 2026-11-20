import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BarberServiceService } from '../../service/barber-service.service';
import { SessionService } from '../../../../core/auth/services/session.service';
import { toUserMessage } from '../../../../core/errors';

import { BarberServicePayload, ServicioFormValue } from './models/servicio.model';
import { buildServicePayload, toServiciosView } from './mappers/servicio.mapper';

import { ServicioFormComponent } from './servicio-form/servicio-form.component';
import { CatalogoServiciosComponent } from './catalogo-servicios/catalogo-servicios.component';

// Se mantiene exportado desde aquí por si otros archivos ya lo importan de este componente
export type { BarberServicePayload } from './models/servicio.model';

type TipoAviso = 'exito' | 'error';

/**
 * Contenedor (smart): guarda el estado, habla con el backend y orquesta a los hijos.
 */
@Component({
  selector: 'app-crud-servicios',
  standalone: true,
  imports: [
    CommonModule,
    ServicioFormComponent,
    CatalogoServiciosComponent
  ],
  templateUrl: './crud-servicios.component.html',
  styleUrls: ['./crud-servicios.component.css']
})
export class BarberServiConfigComponent implements OnInit {
  private readonly sessionService = inject(SessionService);
  private readonly barberService = inject(BarberServiceService);

  @ViewChild(ServicioFormComponent) private formRef?: ServicioFormComponent;

  servicesList: BarberServicePayload[] = [];
  /** El administrador solo gestiona los servicios de su propia barbería (sesión). */
  readonly currentBarberiaId: string = this.sessionService.getBarbershopId() ?? '';

  /** Aviso dentro de la página (reemplaza las ventanas emergentes del navegador). */
  aviso: { tipo: TipoAviso; texto: string } | null = null;
  private avisoTimer?: ReturnType<typeof setTimeout>;

  /** Servicio en edición (copia); null = modo crear */
  editando: BarberServicePayload | null = null;

  ngOnInit(): void {
    if (!this.currentBarberiaId) {
      this.mostrarAviso('error', 'Tu sesión no tiene una barbería asociada. Vuelve a iniciar sesión.', false);
      return;
    }
    this.loadAllServices();
  }

  // ───────────────────────── Carga de datos ─────────────────────────

  loadAllServices(): void {
    this.barberService.getServicesByBarberiaId(this.currentBarberiaId).subscribe({
      next: (data: any) => {
        this.servicesList = toServiciosView(data);
      },
      error: (err: any) => {
        console.error('❌ Error al obtener los servicios del servidor:', err);
      }
    });
  }

  // ───────────────────────── Eventos de los hijos ─────────────────────────


  saveService(values: ServicioFormValue): void {
    // La barbería siempre es la del administrador, nunca la que llegue del formulario.
    const payload = buildServicePayload({ ...values, barberiaId: this.currentBarberiaId });
    this.aviso = null;

    if (this.editando?.id != null) {
      this.barberService.updateService(this.editando.id, payload).subscribe({
        next: () => {
          this.mostrarAviso('exito', 'Servicio modificado correctamente.');
          this.cancelEdit();
          this.loadAllServices();
        },
        error: (err: any) => {
          console.error('❌ [UPDATE ERROR FULL]:', err);
          this.mostrarAviso('error', toUserMessage(err, { DEFAULT: 'No fue posible actualizar el servicio.' }), false);
        }
      });
    } else {
      this.barberService.createService(payload).subscribe({
        next: () => {
          this.mostrarAviso('exito', 'Servicio registrado correctamente.');
          this.formRef?.reset();
          this.loadAllServices();
        },
        error: (err: any) => {
          console.error('❌ [CREATE ERROR]:', err);
          this.mostrarAviso('error', toUserMessage(err, { DEFAULT: 'No fue posible registrar el servicio.' }), false);
        }
      });
    }
  }

  editService(servicio: BarberServicePayload): void {
    if (!servicio.id) {
      this.mostrarAviso('error', 'Este servicio no tiene un identificador válido para editarlo.', false);
      return;
    }
    this.editando = { ...servicio }; // copia nueva: el formulario se recarga aunque se pulse el mismo
  }

  cancelEdit(): void {
    this.editando = null; // el formulario se limpia al ver el cambio
  }

  // TODO: solo cambia el estado en pantalla; falta persistirlo en el backend
  toggleServiceStatus(servicio: BarberServicePayload): void {
    servicio.isActive = !(servicio.isActive ?? true);
  }

  // TODO: solo quita el servicio de la lista; falta el DELETE en el backend
  deleteService(servicio: BarberServicePayload): void {
    if (!confirm('¿Estás seguro de eliminar este servicio?')) return;

    this.servicesList = this.servicesList.filter(s => s !== servicio);
    if (this.editando?.id === servicio.id) {
      this.cancelEdit();
    }
  }

  cerrarAviso(): void {
    clearTimeout(this.avisoTimer);
    this.aviso = null;
  }

  /** Los avisos de éxito se ocultan solos; los de error quedan hasta cerrarlos. */
  private mostrarAviso(tipo: TipoAviso, texto: string, autoOcultar = true): void {
    clearTimeout(this.avisoTimer);
    this.aviso = { tipo, texto };
    if (autoOcultar) {
      this.avisoTimer = setTimeout(() => (this.aviso = null), 4000);
    }
  }
}
