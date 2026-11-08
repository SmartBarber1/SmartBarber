import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    signal
} from '@angular/core';

import {
    FormBuilder,
    FormControl,
    ReactiveFormsModule,
    Validators
} from '@angular/forms';

import { Router } from '@angular/router';

import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
    PERSON_DOCUMENT_TYPES,
    documentNumberValidator,
    mobilePhoneValidator,
    normalizeDocument,
    normalizePhone,
    normalizeText,
    personNameValidator,
    validationMessage
} from '../../../../shared/forms/colombia-validators';

import { FirebaseAuthService } from '../../../../core/auth/services/firebase-auth.service';
import { LegalConsentComponent } from '../../../../shared/components/legal-consent/legal-consent.component';
import { AuthLegalNoticeComponent } from '../../../../shared/components/legal-consent/auth-legal-notice.component';

import { RegisterClientUseCase } from '../../application/use-cases/register-client.use-case';
import {
    DocumentType
} from '../../../barber-shop/domain/models/barber-shop.model';

import {
    toUserMessage
} from '../../../../core/errors';

@Component({
    selector: 'app-register',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        LegalConsentComponent,
        AuthLegalNoticeComponent
    ],
    templateUrl: './register.component.html',
    styleUrl: './register.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterComponent {

    private readonly formBuilder = inject(FormBuilder);

    private readonly router = inject(Router);

    private readonly firebaseAuth =
        inject(FirebaseAuthService);

    private readonly registerClient =
        inject(RegisterClientUseCase);

    readonly currentUser =
        signal(this.firebaseAuth.getCurrentUser());

    readonly selectedRole =
        signal<'CLIENT' | 'BARBER_SHOP' | null>(null);

    readonly loadingGoogle =
        signal(false);

    readonly submitting =
        signal(false);

    readonly successMessage =
        signal('');

    readonly errorMessage =
        signal('');

    /**
     * Autorización de tratamiento de datos (Ley 1581 de 2012).
     * Va separada del formulario para no alterar el cuerpo que recibe el backend.
     */
    readonly legalConsent =
        new FormControl(false, {
            nonNullable: true,
            validators: [Validators.requiredTrue]
        });

    readonly consentAttempted =
        signal(false);

    readonly googleAuthenticated =
        computed(() => !!this.currentUser());

    readonly clientSelected =
        computed(() => this.selectedRole() === 'CLIENT');

    readonly clientForm =
        this.formBuilder.nonNullable.group({

            name: [
                '',
                [
                    Validators.required,
                    Validators.maxLength(100),
                    personNameValidator()
                ]
            ],

            documentType:
                this.formBuilder.nonNullable.control<DocumentType>(
                    'CC',
                    [
                        Validators.required
                    ]
                ),

            document: [
                '',
                [
                    Validators.required,
                    documentNumberValidator()
                ]
            ],

            cell: [
                '',
                [
                    Validators.required,
                    mobilePhoneValidator()
                ]
            ]
        });

    /** Un cliente es una persona natural: solo cédula de ciudadanía o de extranjería. */
    readonly documentTypes = PERSON_DOCUMENT_TYPES;

    constructor() {
        // El formato del número depende del tipo de documento.
        this.clientForm.controls.documentType.valueChanges
            .pipe(takeUntilDestroyed())
            .subscribe(() => this.clientForm.controls.document.updateValueAndValidity());
    }


    async continueWithGoogle(): Promise<void> {

        this.loadingGoogle.set(true);
        this.errorMessage.set('');
        this.successMessage.set('');

        try {

            const user =
                await this.firebaseAuth.signInWithGoogle();

            this.currentUser.set(user);

        } catch (error) {

            console.error(
                'Error de autenticación con Google:',
                error
            );

            this.errorMessage.set(
                this.getFirebaseErrorMessage(error)
            );

        } finally {

            this.loadingGoogle.set(false);
        }
    }

    selectRole(
        role: 'CLIENT' | 'BARBER_SHOP'
    ): void {

        this.selectedRole.set(role);

        this.errorMessage.set('');
        this.successMessage.set('');

        if (role === 'BARBER_SHOP') {

            this.router.navigate(['auth/register-admin']);

            return;
        }

        this.clientForm.reset({
            name:
                this.currentUser()?.displayName ?? '',

            documentType: 'CC',

            document: '',

            cell: ''
        });
    }


    submitClientRegistration(): void {

        this.errorMessage.set('');
        this.successMessage.set('');

        if (!this.currentUser()) {

            this.errorMessage.set(
                'Continúa con Google antes de registrarte.'
            );

            return;
        }

        this.consentAttempted.set(true);

        if (this.clientForm.invalid || this.legalConsent.invalid) {

            this.clientForm.markAllAsTouched();
            this.legalConsent.markAsTouched();

            this.errorMessage.set(
                'Corrige los campos resaltados.'
            );

            return;
        }

        this.submitting.set(true);

        const raw = this.clientForm.getRawValue();

        this.registerClient
            .execute({
                ...raw,
                name: normalizeText(raw.name),
                document: normalizeDocument(raw.documentType, raw.document),
                cell: normalizePhone(raw.cell)
            })
            .subscribe({

                next: () => {

                    this.successMessage.set(
                        'Tu cuenta de cliente ha sido registrada correctamente.'
                    );

                    /*
                     * The user is already authenticated with Firebase,
                     * so there is no need to redirect to a login page.
                     */
                    setTimeout(() => {
                        this.router.navigate(['/']);
                    }, 1200);
                },

                error: (error) => {

                    console.error(
                        'Error en el registro del cliente:',
                        error
                    );

                    this.errorMessage.set(
                        this.getBackendErrorMessage(error)
                    );

                    this.submitting.set(false);
                },

                complete: () => {
                    this.submitting.set(false);
                }
            });
    }

    /** Mensaje de validación del campo, o null si no hay error visible. */
    errorFor(controlName: 'name' | 'document' | 'cell'): string | null {
        return validationMessage(this.clientForm.controls[controlName]);
    }

    hasError(
        controlName: string,
        errorName: string
    ): boolean {

        const control =
            this.clientForm.get(controlName);

        return !!(
            control &&
            control.touched &&
            control.hasError(errorName)
        );
    }

    getFirebaseErrorMessage(error: unknown): string {

        const firebaseError =
            error as { code?: string };

        switch (firebaseError.code) {

            case 'auth/popup-closed-by-user':
                return 'La ventana de autenticación de Google fue cerrada.';

            case 'auth/popup-blocked':
                return 'El navegador bloqueó la ventana de autenticación de Google.';

            case 'auth/cancelled-popup-request':
                return 'La solicitud de autenticación de Google fue cancelada.';

            case 'auth/account-exists-with-different-credential':
                return 'Este correo electrónico ya está asociado con otro método de autenticación.';

            case 'auth/network-request-failed':
                return 'Ocurrió un error de red. Inténtalo nuevamente.';

            default:
                return 'No fue posible autenticarte con Google. Inténtalo nuevamente.';
        }
    }

    getBackendErrorMessage(
        error: unknown
    ): string {
        return toUserMessage(error, {
            US_002: 'Esta cuenta de Google ya está registrada. Inicia sesión en lugar de registrarte.',
            CT_002: 'Ya existe un cliente registrado con estos datos. Si es tu cuenta, inicia sesión.',
            TECH_001: 'Revisa los datos del formulario.',
            HTTP_401: 'La sesión de Google no es válida. Vuelve a vincular tu cuenta.',
            DEFAULT: 'Ocurrió un error inesperado durante el registro. Inténtalo nuevamente.'
        });
    }
}