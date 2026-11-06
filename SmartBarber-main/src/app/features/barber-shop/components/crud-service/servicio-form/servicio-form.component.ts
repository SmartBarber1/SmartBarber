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

  onSubmit(): void {
    if (this.serviceForm.invalid) {
      alert('⚠️ Por favor completa todos los campos del servicio correctamente.');
      return;
    }
    this.guardar.emit(this.serviceForm.value as ServicioFormValue);
  }

  /** Lo llama el padre después de crear con éxito */
  reset(): void {
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
