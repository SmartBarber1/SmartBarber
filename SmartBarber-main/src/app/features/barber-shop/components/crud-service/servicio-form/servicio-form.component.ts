import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BarberServicePayload, ServicioFormValue } from '../models/servicio.model';

/**
 * Formulario de crear / modificar servicio.
 * Es dueño del FormGroup y de sus validaciones; el padre solo recibe el valor ya validado.
 */
@Component({
  selector: 'app-servicio-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './servicio-form.component.html',
  styleUrls: ['./servicio-form.component.css']
})
export class ServicioFormComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  /** Barbería activa: se refleja en el campo oculto barberiaId */
  @Input() barberiaId: string = '';
  /** Servicio en edición; null = modo crear */
  @Input() editando: BarberServicePayload | null = null;

  @Output() guardar = new EventEmitter<ServicioFormValue>();
  @Output() cancelar = new EventEmitter<void>();

  serviceForm: FormGroup = this.fb.group({
    barberiaId: ['', [Validators.required]],
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.required]],
    duration: [15, [Validators.required, Validators.min(5)]],
    price: [1000, [Validators.required, Validators.min(0)]],
    offert: [false],
    special_price: [0, [Validators.min(0)]],
    isActive: [true]
  });

  constructor() {
    this.serviceForm.get('offert')?.valueChanges.subscribe((isOffert: boolean) => {
      const specialPrice = this.serviceForm.get('special_price');
      if (isOffert) {
        specialPrice?.setValidators([Validators.required, Validators.min(1)]);
      } else {
        specialPrice?.clearValidators();
        specialPrice?.setValue(0);
      }
      specialPrice?.updateValueAndValidity();
    });
  }

  get isEditMode(): boolean {
    return this.editando !== null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['barberiaId']) {
      this.serviceForm.patchValue({ barberiaId: this.barberiaId });
    }

    if (changes['editando']) {
      if (this.editando) {
        this.cargar(this.editando);
      } else if (!changes['editando'].firstChange) {
        this.reset(); // el padre canceló la edición
      }
    }
  }

  /** Se intentó enviar: a partir de aquí se muestran los errores de todos los campos. */
  intentoEnvio = false;

  onSubmit(): void {
    this.intentoEnvio = true;
    if (this.serviceForm.invalid) {
      this.serviceForm.markAllAsTouched();
      return;
    }
    this.guardar.emit(this.serviceForm.value as ServicioFormValue);
  }

  /** Mensaje de error del campo, o null si es válido o aún no se ha tocado. */
  errorDe(campo: string): string | null {
    const control = this.serviceForm.get(campo);
    if (!control || control.valid || !(control.touched || this.intentoEnvio)) {
      return null;
    }
    const e = control.errors ?? {};
    switch (campo) {
      case 'name':
        return e['required'] ? 'Escribe el nombre del servicio.' : 'El nombre debe tener al menos 3 caracteres.';
      case 'description':
        return 'Escribe una descripción del servicio.';
      case 'duration':
        return e['required'] ? 'Indica la duración en minutos.' : 'La duración debe ser de al menos 5 minutos.';
      case 'price':
        return e['required'] ? 'Indica el precio del servicio.' : 'El precio no puede ser negativo.';
      case 'special_price':
        return 'El precio de oferta debe ser mayor que 0.';
      default:
        return 'Revisa este campo.';
    }
  }

  /** Lo llama el padre después de crear con éxito */
  reset(): void {
    this.intentoEnvio = false;
    this.serviceForm.markAsUntouched();
    this.serviceForm.patchValue({
      barberiaId: this.barberiaId,
      name: '',
      description: '',
      duration: 15,
      price: 1000,
      offert: false,
      special_price: 0,
      isActive: true
    });
  }

  private cargar(service: BarberServicePayload): void {
    this.serviceForm.patchValue({
      barberiaId: service.barberiaId || this.barberiaId,
      name: service.name,
      description: service.description,
      duration: service.duration,
      price: service.price,
      offert: service.offert,
      special_price: service.special_price,
      isActive: service.isActive ?? true
    });
  }
}
