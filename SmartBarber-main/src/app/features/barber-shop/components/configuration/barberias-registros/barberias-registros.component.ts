import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output
} from '@angular/core';

import {
  CommonModule
} from '@angular/common';

import {
    AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';

import { toApiError } from '../../../../../core/errors';

/** Teléfono: 10 dígitos, la misma regla que aplica el servidor. */
const TELEFONO = /^[0-9]{10}$/;

/** Documento según el tipo elegido; el NIT admite dígito de verificación opcional. */
const DOCUMENTO: Record<string, RegExp> = {
  NIT: /^\d{6,10}(-?\d)?$/,
  CC: /^\d{4,10}$/,
  CE: /^[A-Za-z0-9]{3,10}$/
};

function documentoValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const tipo = control.parent?.get('tipoDocumento')?.value as string | undefined;
    const valor = String(control.value ?? '').trim();
    if (!valor || !tipo || !DOCUMENTO[tipo]) {
      return null;
    }
    return DOCUMENTO[tipo].test(valor) ? null : { documento: true };
  };
}

/** Mensajes por campo, mostrados bajo cada control. */
const MENSAJES: Record<string, Record<string, string>> = {
  nombre: { required: 'El nombre es obligatorio.', maxlength: 'El nombre admite máximo 100 caracteres.' },
  razonSocial: { maxlength: 'La razón social admite máximo 150 caracteres.' },
  tipoDocumento: { required: 'Selecciona el tipo de documento.' },
  documento: {
    required: 'El documento es obligatorio.',
    documento: 'Escribe un número válido: NIT de 6 a 10 dígitos (con o sin dígito de verificación), CC de 4 a 10 dígitos o CE de 3 a 10 caracteres.'
  },
  telefono: {
    required: 'El teléfono es obligatorio.',
    telefono: 'El teléfono debe tener exactamente 10 dígitos, sin letras ni espacios.'
  },
  ubicacion: { required: 'La ubicación es obligatoria.' },
  descripcion: { maxlength: 'La descripción admite máximo 500 caracteres.' }
};

/** Campo del backend → control del formulario. */
const CAMPOS_BACKEND: Record<string, string> = {
  name: 'nombre',
  companyName: 'razonSocial',
  documentType: 'tipoDocumento',
  document: 'documento',
  phone: 'telefono',
  location: 'ubicacion',
  description: 'descripcion'
};

import {
  BarberShopApiService
} from '../../../infrastructure/services/barber-shop-api.service';

import {
  BarberShopResponse
} from '../../../domain/models/barber-shop.model';


@Component({
  selector: 'app-barberias-registros',

  standalone: true,

  imports: [
    CommonModule,
    ReactiveFormsModule
  ],

  templateUrl:
    './barberias-registros.component.html',

  styleUrls: [
    './barberias-registros.component.css'
  ]
})
export class BarberiasRegistrosComponent
  implements OnInit {


  @Input()
  barberList: BarberShopResponse[] = [];


  @Input()
  barberId = '';

  @Input()
  set editing(value: boolean) {
    this.isEditing = value;
  }

  private selectedBarber: BarberShopResponse | null = null;

  @Input()
  set seleccionado(
    item: BarberShopResponse | null
  ) {
    this.selectedBarber = item;

    if (
      item &&
      this.infoForm
    ) {

      this.patchFormValues(item);

      this.selectedId =
        String(item.id ?? '');
    }
  }


  @Output()
  barberiaSeleccionada =
    new EventEmitter<BarberShopResponse>();


  @Output()
  guardado =
    new EventEmitter<void>();


  infoForm!: FormGroup;

  isEditing = false;

  selectedId = '';

  saving = false;

  formError = '';


  constructor(
    private readonly fb: FormBuilder,

    private readonly api:
      BarberShopApiService
  ) {}


    ngOnInit(): void {
    this.initForm();

    // Al cambiar el tipo de documento se vuelve a validar el número.
    this.infoForm.get('tipoDocumento')?.valueChanges.subscribe(() =>
      this.infoForm.get('documento')?.updateValueAndValidity()
    );

    if (this.selectedBarber) {
      this.patchFormValues(this.selectedBarber);
      this.selectedId = String(this.selectedBarber.id ?? '');
    }
  }


  private initForm(): void {

    this.infoForm =
      this.fb.group({

        nombre: [
          '',
          [
            Validators.required,
            Validators.maxLength(100)
          ]
        ],

        razonSocial: [
          '',
          Validators.maxLength(150)
        ],

        tipoDocumento: [
          '',
          Validators.required
        ],

        documento: [
          '',
          [
            Validators.required,
            Validators.maxLength(50),
            documentoValidator()
          ]
        ],

        telefono: [
          '',
          [
            Validators.required,
            Validators.pattern(TELEFONO)
          ]
        ],

        ubicacion: [
          '',
          Validators.required
        ],

        descripcion: [
          '',
          Validators.maxLength(500)
        ]

      });
  }


  // ============================================================
  // SELECCIONAR PARA EDITAR
  // ============================================================

  edit(item: BarberShopResponse): void {

    this.isEditing = true;

    this.selectedId =
      String(item.id ?? '');

    this.patchFormValues(item);

    this.barberiaSeleccionada.emit(item);
  }


  // ============================================================
  // CONSULTAR
  // ============================================================

  view(item: BarberShopResponse): void {

    this.isEditing = false;

    this.selectedId =
      String(item.id ?? '');

    this.patchFormValues(item);

    this.barberiaSeleccionada.emit(item);
  }


  // ============================================================
  // FORMULARIO
  // ============================================================

  private patchFormValues(
    item: BarberShopResponse
  ): void {

    this.infoForm.patchValue({

      nombre:
        item.name ?? '',

      razonSocial:
        item.companyName ?? '',

      tipoDocumento:
        item.documentType ?? '',

      documento:
        item.document ?? '',

      telefono:
        item.phone ?? '',

      ubicacion:
        item.location ?? '',

      descripcion:
        item.description ?? ''

    });
  }


  // ============================================================
  // CANCELAR
  // ============================================================

  cancelEdit(): void {

    this.isEditing = false;

    this.formError = '';
  }


  // ============================================================
  // GUARDAR
  // ============================================================

  saveGeneralConfig(): void {

    if (
      this.infoForm.invalid ||
      this.saving
    ) {

      this.infoForm.markAllAsTouched();

      return;
    }


    if (!this.selectedId) {

      this.formError =
        'No se identificó la barbería que deseas actualizar.';

      return;
    }


    const value =
      this.infoForm.getRawValue();


    this.saving = true;

    this.formError = '';


    this.api
      .update(
        this.selectedId,
        {

          name:
            value.nombre.trim(),

          companyName:
            value.razonSocial?.trim() || '',

          documentType:
            value.tipoDocumento,

          document:
            value.documento.trim(),

          phone:
            value.telefono.trim(),

          location:
            value.ubicacion.trim(),

          description:
            value.descripcion?.trim() || ''

        }
      )
      .subscribe({

        next: (updated) => {

          this.saving = false;

          this.isEditing = false;

          this.barberiaSeleccionada.emit(
            updated
          );

          this.guardado.emit();
        },

        error: (error) => {

          console.error(
            '[Mi barbería] Error actualizando:',
            error
          );

          this.saving = false;

          this.applyServerErrors(error);
        }

      });
  }


  // ============================================================
  // HELPERS
  // ============================================================

    /** Mensaje del primer error del campo, o null si no debe mostrarse. */
  fieldError(field: string): string | null {
    const control = this.infoForm.get(field);
    if (!control || !control.errors || !control.touched) {
      return null;
    }
    for (const key of Object.keys(control.errors)) {
      if (key === 'server') {
        return control.errors[key] as string;
      }
      if (key === 'pattern' && field === 'telefono') {
        return MENSAJES['telefono']['telefono'];
      }
      const message = MENSAJES[field]?.[key];
      if (message) {
        return message;
      }
    }
    return 'Revisa este campo.';
  }

  /** Marca bajo cada campo lo que rechazó el servidor; el resto va al mensaje general. */
  private applyServerErrors(error: unknown): void {
    const apiError = toApiError(error, {
      DEFAULT: 'No fue posible actualizar la información de la barbería. Intenta de nuevo.'
    });
    let marcados = 0;

    for (const backendField of Object.keys(apiError.fields)) {
      const controlName = CAMPOS_BACKEND[backendField];
      const control = controlName ? this.infoForm.get(controlName) : null;
      if (!control) {
        continue;
      }
      // Texto propio en lugar del mensaje técnico del servidor.
      const propio = MENSAJES[controlName]?.[controlName === 'telefono' ? 'telefono' : 'documento']
        ?? 'Revisa este campo.';
      control.setErrors({ ...(control.errors ?? {}), server: propio });
      control.markAsTouched();
      marcados++;
    }

    this.formError = marcados > 0
      ? 'Corrige los campos marcados para guardar los cambios.'
      : apiError.message;
  }

  getFieldInvalid(
    field: string
  ): boolean {

    const control =
      this.infoForm.get(field);

    return !!control &&
      control.invalid &&
      control.touched;
  }
}