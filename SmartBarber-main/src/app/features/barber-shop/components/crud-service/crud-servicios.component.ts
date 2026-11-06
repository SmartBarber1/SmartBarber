import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BarberServiceService } from '../../service/barber-service.service';
import { BarberShopApiService } from '../../infrastructure/services/barber-shop-api.service';

import { BarberServicePayload, BarberiaOpcion, ServicioFormValue } from './models/servicio.model';
import { buildServicePayload, toBarberiaOpciones, toServiciosView } from './mappers/servicio.mapper';

import { ServicioFormComponent } from './servicio-form/servicio-form.component';
import { BarberiaSelectComponent } from './barberia-select/barberia-select.component';
import { CatalogoServiciosComponent } from './catalogo-servicios/catalogo-servicios.component';

// Se mantiene exportado desde aquí por si otros archivos ya lo importan de este componente
export type { BarberServicePayload } from './models/servicio.model';

// TODO: debe salir de la sesión / ruta del usuario, no de un valor fijo
const BARBERIA_POR_DEFECTO = '3563acd0-d8e2-4018-aabf-b47d3d9cde11';

/**
 * Contenedor (smart): guarda el estado, habla con el backend y orquesta a los hijos.
 */
@Component({
  selector: 'app-crud-servicios',
  standalone: true,
  imports: [
    CommonModule,
    ServicioFormComponent,
    BarberiaSelectComponent,
    CatalogoServiciosComponent
  ],
  templateUrl: './crud-servicios.component.html',
  styleUrls: ['./crud-servicios.component.css']
})
export class BarberServiConfigComponent implements OnInit {
  private readonly barberShopApiService = inject(BarberShopApiService);
  private readonly barberService = inject(BarberServiceService);

  @ViewChild(ServicioFormComponent) private formRef?: ServicioFormComponent;

  servicesList: BarberServicePayload[] = [];
  barberiasList: BarberiaOpcion[] = [];
  currentBarberiaId: string = BARBERIA_POR_DEFECTO;

  /** Servicio en edición (copia); null = modo crear */
  editando: BarberServicePayload | null = null;

  ngOnInit(): void {
    this.loadBarberias();
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

  loadBarberias(): void {
    this.barberShopApiService.getAll().subscribe({
      next: (data: any) => {
        this.barberiasList = toBarberiaOpciones(data);
      },
      error: (err: any) => {
        console.error('❌ Error al cargar las barberías:', err);
      }
    });
  }

  // ───────────────────────── Eventos de los hijos ─────────────────────────

  onBarberiaSelected(barberiaId: string): void {
    this.currentBarberiaId = barberiaId; // el formulario se actualiza por su @Input barberiaId
    this.loadAllServices();
  }

  saveService(values: ServicioFormValue): void {
    const payload = buildServicePayload(values);

    if (this.editando?.id != null) {
      this.barberService.updateService(this.editando.id, payload).subscribe({
        next: () => {
          alert('¡Servicio modificado en la base de datos exitosamente! ✏️');
          this.cancelEdit();
          this.loadAllServices();
        },
        error: (err: any) => {
          console.error('❌ [UPDATE ERROR FULL]:', err);
          alert('Hubo un error al actualizar el servicio en la base de datos.');
        }
      });
    } else {
      this.barberService.createService(payload).subscribe({
        next: () => {
          alert('¡Servicio registrado exitosamente! 💈');
          this.formRef?.reset();
          this.loadAllServices();
        },
        error: (err: any) => {
          console.error('❌ [CREATE ERROR]:', err);
          alert('Hubo un error al conectar con el servidor.');
        }
      });
    }
  }

  editService(servicio: BarberServicePayload): void {
    if (!servicio.id) {
      alert('⚠️ Este servicio no tiene un ID válido para editar.');
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
}
