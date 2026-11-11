import {
    CommonModule
} from '@angular/common';

import {
    Component,
    DestroyRef,
    EventEmitter,
    Input,
    Output,
    inject
} from '@angular/core';

import {
    takeUntilDestroyed
} from '@angular/core/rxjs-interop';

import {
    AbstractControl,
    FormBuilder,
    ReactiveFormsModule,
    ValidationErrors,
    ValidatorFn,
    Validators
} from '@angular/forms';

import {
    finalize
} from 'rxjs';

import {
    User
} from 'firebase/auth';

import {
    CreateEmployeeUseCase
} from '../../application/use-cases/create-employee.use-case';

import {
    EmployeeRegistration
} from '../../domain/models/employee-registration.model';

import {
    Employee
} from '../../domain/models/employee.model';

import {
    FirebaseAuthService
} from '../../../../core/auth/services/firebase-auth.service';

import {
    USER_ROLE_IDS
} from '../../../authentication/domain/models/user-role.model';

import {
    ErrorMessageOverrides,
    toApiError
} from '../../../../core/errors';

import {
    documentNumberValidator,
    mobilePhoneValidator,
    normalizeDocument,
    normalizePhone,
    normalizeText,
    notBlankValidator,
    personNameValidator,
    validationMessage
} from '../../../../shared/forms/colombia-validators';

import {
    applyServerFieldErrors
} from '../../../../shared/forms/server-field-errors';

/** Mensajes propios del registro de barberos (sobrescriben el catálogo general). */
const EMPLOYEE_ERROR_MESSAGES: ErrorMessageOverrides = {
    US_006: 'Solo el administrador de esta barbería puede registrar barberos.',
    US_002: 'La cuenta de Google seleccionada ya pertenece a otro usuario de SmartBarber. Vincula una cuenta diferente.',
    CT_002: 'Ya existe un barbero registrado con ese número de documento.',
    VALIDATION: 'Revisa los campos marcados en el formulario.',
    TECH_001: 'La sesión de la cuenta de Google vinculada no es válida. Vuelve a vincularla.',
    TECH_008: 'La sesión de la cuenta de Google vinculada expiró. Vuelve a vincularla.',
    DEFAULT: 'No fue posible registrar al barbero. Inténtalo nuevamente.'
};

/** Errores que obligan a vincular otra cuenta de Google. */
const ACCOUNT_ERROR_CODES = new Set(['US_002', 'TECH_001', 'TECH_008']);

/** Campo del backend → control del formulario. */
const SERVER_FIELD_ALIASES: Readonly<Record<string, string>> = {
    specialty: 'specialties'
};

const NAME_MAX_LENGTH = 120;

function atLeastOneSelected(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null =>
        Array.isArray(control.value) && control.value.length > 0
            ? null
            : { required: true };
}

@Component({
    selector: 'app-employee-register',

    standalone: true,

    imports: [
        CommonModule,
        ReactiveFormsModule
    ],

    templateUrl:
        './employee-register.component.html',

    styleUrl:
        './employee-register.component.css'
})
export class EmployeeRegisterComponent {

    private readonly fb =
        inject(FormBuilder);

    private readonly createEmployee =
        inject(CreateEmployeeUseCase);

    private readonly firebaseAuth =
        inject(FirebaseAuthService);

    private readonly destroyRef =
        inject(DestroyRef);

    @Input()
    barberiaId = '';

    @Output()
    registered =
        new EventEmitter<Employee>();

    @Output()
    cancelled =
        new EventEmitter<void>();

    isSubmitting = false;

    isConnectingGoogle = false;

    submitted = false;

    successMessage = '';

    backendError = '';

    registrationUser: User | null = null;

    readonly nameMaxLength = NAME_MAX_LENGTH;

    readonly specialties = [
        'Cortes',
        'Barba',
        'Colorimetría',
        'Tratamientos capilares'
    ] as const;

    readonly form =
        this.fb.nonNullable.group({

            name: [
                '',
                [
                    Validators.required,
                    notBlankValidator(),
                    Validators.minLength(3),
                    Validators.maxLength(NAME_MAX_LENGTH),
                    personNameValidator()
                ]
            ],

            documentType: [
                'CC' as 'CC' | 'CE',
                Validators.required
            ],

            document: [
                '',
                [
                    Validators.required,
                    documentNumberValidator()
                ]
            ],

            email: [
                '',
                [
                    Validators.required,
                    Validators.email
                ]
            ],

            cell: [
                '',
                [
                    Validators.required,
                    mobilePhoneValidator()
                ]
            ],

            specialties: [
                [] as string[],
                atLeastOneSelected()
            ]
        });

    constructor() {
        // El documento se valida según el tipo elegido (CC o CE).
        this.form.controls.documentType.valueChanges
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() =>
                this.form.controls.document.updateValueAndValidity()
            );
    }

    /** Mensaje de error de un campo, solo cuando el usuario ya lo tocó. */
    errorFor(controlName: keyof typeof this.form.controls): string | null {
        return validationMessage(this.form.controls[controlName], {
            required: controlName === 'specialties'
                ? 'Selecciona al menos una especialidad.'
                : 'Este campo es obligatorio.',
            email: 'Vincula una cuenta de Google con un correo válido.'
        });
    }

    isSelected(specialty: string): boolean {
        return this.form.controls.specialties.value.includes(specialty);
    }

    toggleSpecialty(
        specialty: string,
        checked: boolean
    ): void {
        const control = this.form.controls.specialties;
        const current = control.value.filter(item => item !== specialty);

        control.setValue(checked ? [...current, specialty] : current);
        control.markAsTouched();
    }

    async connectGoogleAccount(): Promise<void> {
        if (this.isConnectingGoogle || this.isSubmitting) {
            return;
        }

        this.backendError = '';
        this.successMessage = '';
        this.isConnectingGoogle = true;

        try {
            await this.releaseLinkedAccount();

            const user =
                await this.firebaseAuth
                    .signInWithGoogleForEmployeeRegistration();

            if (!user.email || !user.emailVerified) {
                await this.firebaseAuth
                    .signOutEmployeeRegistration();

                this.backendError =
                    'La cuenta de Google debe tener un correo verificado para poder iniciar sesión.';

                return;
            }

            this.registrationUser = user;
            this.form.controls.email.setValue(
                user.email.trim().toLowerCase()
            );
            this.form.controls.email.markAsTouched();
        } catch (error: unknown) {
            this.backendError =
                toApiError(error, EMPLOYEE_ERROR_MESSAGES).message;
        } finally {
            this.isConnectingGoogle = false;
        }
    }

    async cancelRegistration(): Promise<void> {
        if (this.isSubmitting || this.isConnectingGoogle) {
            return;
        }

        try {
            await this.releaseLinkedAccount();
        } catch (error: unknown) {
            this.backendError =
                toApiError(error, EMPLOYEE_ERROR_MESSAGES).message;

            return;
        }

        this.cancelled.emit();
    }

    async submit(): Promise<void> {
        if (this.isSubmitting) {
            return;
        }

        this.submitted = true;
        this.successMessage = '';
        this.backendError = '';

        // Se marcan todos los campos para mostrar de una vez todo lo que falta.
        this.form.markAllAsTouched();

        if (!this.registrationUser) {
            this.backendError =
                'Primero vincula la cuenta de Google que utilizará el barbero para iniciar sesión.';

            return;
        }

        if (this.form.invalid) {
            this.form.markAllAsTouched();
            this.backendError =
                'Revisa los campos marcados antes de continuar.';

            return;
        }

        if (!this.barberiaId) {
            this.backendError =
                'No fue posible identificar la barbería de esta sesión. Vuelve a iniciar sesión.';

            return;
        }

        const request = this.buildRequest();

        this.isSubmitting = true;

        let employeeIdToken: string;

        try {
            // Token vigente de la cuenta vinculada. La sesión secundaria se
            // conserva hasta que el registro termine, para poder corregir
            // datos y reintentar sin volver a vincular la cuenta.
            employeeIdToken =
                await this.registrationUser.getIdToken();
        } catch (error: unknown) {
            this.isSubmitting = false;
            this.backendError =
                toApiError(error, EMPLOYEE_ERROR_MESSAGES).message;

            return;
        }

        this.createEmployee
            .execute(request, employeeIdToken)
            .pipe(
                finalize(() => this.isSubmitting = false)
            )
            .subscribe({
                next: employee => {
                    void this.releaseLinkedAccount();

                    this.successMessage =
                        'Barbero registrado correctamente. Podrá iniciar sesión con la cuenta de Google vinculada.';

                    this.submitted = false;
                    this.form.reset({
                        name: '',
                        documentType: 'CC',
                        document: '',
                        email: '',
                        cell: '',
                        specialties: []
                    });

                    this.registered.emit(employee);
                },

                error: error => this.handleBackendError(error)
            });
    }

    private buildRequest(): EmployeeRegistration {
        const value = this.form.getRawValue();

        return {
            user: {
                roleId: USER_ROLE_IDS.BARBER
            },
            barberiaId: this.barberiaId,
            name: normalizeText(value.name),
            document: normalizeDocument(value.documentType, value.document),
            documentType: value.documentType,
            cell: normalizePhone(value.cell),
            email: value.email.trim().toLowerCase(),
            specialty: value.specialties.join(', ')
        };
    }

    private handleBackendError(error: unknown): void {
        const apiError = toApiError(error, EMPLOYEE_ERROR_MESSAGES);

        const unmatched = applyServerFieldErrors(
            this.form,
            apiError.fields,
            SERVER_FIELD_ALIASES
        );

        if (apiError.code === 'CT_002') {
            this.form.controls.document.setErrors({ server: apiError.message });
            this.form.controls.document.markAsTouched();
        }

        if (apiError.code && ACCOUNT_ERROR_CODES.has(apiError.code)) {
            void this.releaseLinkedAccount();
        }

        this.backendError = unmatched.length > 0
            ? `${apiError.message} ${unmatched.join(' ')}`
            : apiError.message;
    }

    /** Cierra la sesión temporal de la cuenta de Google del barbero. */
    private async releaseLinkedAccount(): Promise<void> {
        if (!this.registrationUser) {
            return;
        }

        this.registrationUser = null;
        this.form.controls.email.setValue('');
        await this.firebaseAuth.signOutEmployeeRegistration();
    }
}
