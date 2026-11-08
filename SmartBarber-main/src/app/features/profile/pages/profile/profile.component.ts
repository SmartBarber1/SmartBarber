import {
    Component,
    OnInit,
    inject,
    signal
} from '@angular/core';

import {
    CommonModule
} from '@angular/common';

import {
    FormBuilder,
    ReactiveFormsModule,
    Validators
} from '@angular/forms';

import {
    finalize
} from 'rxjs';

import {
    GetProfileUseCase
} from '../../application/use-cases/get-profile.use-case';

import {
    UpdateProfileUseCase
} from '../../application/use-cases/update-profile.use-case';

import {
    UserProfile
} from '../../domain/models/user-profile.model';

import {
    UpdateProfileRequest
} from '../../domain/models/profile.model';

import {
    SessionService
} from '../../../../core/auth/services/session.service';


import { toUserMessage } from '../../../../core/errors';
@Component({
    selector: 'app-profile',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule
    ],
    templateUrl:
        './profile.component.html',

    styleUrl:
        './profile.component.css'
})
export class ProfileComponent
    implements OnInit {


    private readonly formBuilder =
        inject(FormBuilder);

    private readonly getProfileUseCase =
        inject(GetProfileUseCase);

    private readonly updateProfileUseCase =
        inject(UpdateProfileUseCase);

    private readonly sessionService =
        inject(SessionService);


    readonly loading =
        signal(false);

    readonly saving =
        signal(false);

    readonly editing =
        signal(false);

    readonly errorMessage =
        signal('');

    readonly successMessage =
        signal('');

    readonly profile =
        signal<UserProfile | null>(
            null
        );


    readonly profileForm =
        this.formBuilder.nonNullable.group({

            document: [
                {
                    value: '',
                    disabled: true
                }
            ],

            documentType: [
                {
                    value: '',
                    disabled: true
                }
            ],

            name: [
                '',
                [
                    Validators.required,
                    Validators.minLength(3),
                    Validators.maxLength(100)
                ]
            ],

            cell: [
                '',
                [
                    Validators.required,
                    Validators.pattern(
                        /^[0-9]{10}$/
                    )
                ]
            ],

            email: [
                {
                    value: '',
                    disabled: true
                }
            ]
        });


    ngOnInit(): void {

        this.loadProfile();
    }


    loadProfile(): void {

        this.loading.set(true);

        this.editing.set(false);

        this.errorMessage.set('');

        this.successMessage.set('');


        this.getProfileUseCase
            .execute()

            .pipe(
                finalize(
                    () =>
                        this.loading.set(false)
                )
            )

            .subscribe({

                next: (profile) => {

                    this.profile.set(
                        profile
                    );

                    this.fillForm(
                        profile
                    );
                },


                error: (error) => {

                    console.error(
                        'Error loading profile:',
                        error
                    );

                    this.profile.set(
                        null
                    );

                    this.errorMessage.set(
                        this.getErrorMessage(
                            error,
                            false
                        )
                    );
                }
            });
    }


    startEditing(): void {

        const profile =
            this.profile();


        if (
            !profile ||
            !this.canEditProfile()
        ) {

            return;
        }


        this.errorMessage.set('');

        this.successMessage.set('');


        this.fillForm(
            profile
        );


        this.editing.set(
            true
        );
    }


    cancelEditing(): void {

        const profile =
            this.profile();


        if (profile) {

            this.fillForm(
                profile
            );
        }


        this.errorMessage.set('');

        this.successMessage.set('');

        this.editing.set(
            false
        );
    }


    saveProfile(): void {

        if (
            this.saving() ||
            !this.editing()
        ) {

            return;
        }


        this.errorMessage.set('');

        this.successMessage.set('');


        if (
            this.profileForm.invalid
        ) {

            this.profileForm
                .markAllAsTouched();

            this.errorMessage.set(
                'Por favor completa correctamente los campos editables.'
            );

            return;
        }


        const profile =
            this.profile();


        if (
            !profile ||
            !profile.clientId
        ) {

            this.errorMessage.set(
                'No se encontró el perfil de cliente asociado a esta cuenta.'
            );

            return;
        }


        const formValue =
            this.profileForm.getRawValue();


        const request:
            UpdateProfileRequest = {

            userId:
                profile.userId,

            document:
                profile.document ?? '',

            documentType:
                profile.documentType ?? '',

            name:
                formValue.name.trim(),

            cell:
                formValue.cell.trim(),

            email:
                profile.email
        };


        this.saving.set(true);


        this.updateProfileUseCase
            .execute(request)

            .pipe(
                finalize(
                    () =>
                        this.saving.set(false)
                )
            )

            .subscribe({

                next: (updatedProfile) => {

                    const currentProfile =
                        this.profile();


                    this.profile.set({

                        ...(currentProfile as UserProfile),

                        displayName:
                            updatedProfile.name,

                        email:
                            updatedProfile.email,

                        document:
                            updatedProfile.document,

                        documentType:
                            updatedProfile.documentType,

                        name:
                            updatedProfile.name,

                        cell:
                            updatedProfile.cell
                    });


                    const currentSession =
                        this.sessionService.currentSession;


                    if (currentSession) {

                        this.sessionService.setSession({

                            ...currentSession,

                            displayName:
                                updatedProfile.name,

                            email:
                                updatedProfile.email
                        });
                    }


                    this.fillForm(
                        this.profile()!
                    );


                    this.editing.set(
                        false
                    );


                    this.successMessage.set(
                        'Tu perfil fue actualizado correctamente.'
                    );
                },


                error: (error) => {

                    console.error(
                        'Error updating profile:',
                        error
                    );

                    this.errorMessage.set(
                        this.getErrorMessage(
                            error,
                            true
                        )
                    );
                }
            });
    }


    canEditProfile(): boolean {

        return (
            this.profile()?.role ===
            'CLIENT'
        );
    }


    hasBarbershop(): boolean {

        const profile =
            this.profile();

        return !!(
            profile?.barbershopId ||
            profile?.barbershopName
        );
    }


    getRoleLabel(
        role: UserProfile['role']
    ): string {

        switch (role) {

            case 'CLIENT':
                return 'Cliente';

            case 'ADMIN':
                return 'Administrador';

            case 'BARBER':
                return 'Barbero';

            default:
                return role;
        }
    }


    getStatusLabel(
        status: UserProfile['status']
    ): string {

        switch (status) {

            case 'ACTIVE':
                return 'Activo';

            case 'BLOCKED':
                return 'Bloqueado';

            case 'INACTIVE':
                return 'Inactivo';

            default:
                return status;
        }
    }


    getInitials(): string {

        const name =
            this.profile()?.name ||
            this.profile()?.displayName ||
            'U';


        const parts =
            name
                .trim()
                .split(/\s+/)
                .filter(Boolean);


        if (
            parts.length === 1
        ) {

            return parts[0]
                .charAt(0)
                .toUpperCase();
        }


        return (
            parts[0].charAt(0) +
            parts[parts.length - 1]
                .charAt(0)
        ).toUpperCase();
    }


    get nameControl() {

        return this.profileForm
            .controls
            .name;
    }


    get cellControl() {

        return this.profileForm
            .controls
            .cell;
    }


    private fillForm(
        profile: UserProfile
    ): void {

        this.profileForm.patchValue({

            document:
                profile.document ?? '',

            documentType:
                profile.documentType ?? '',

            name:
                profile.name ||
                profile.displayName ||
                '',

            cell:
                profile.cell ?? '',

            email:
                profile.email ?? ''
        });
    }


    private getErrorMessage(
        error: any,
        isUpdate: boolean
    ): string {

        const status =
            error?.status;


        if (status === 400) {

            return toUserMessage(error, {
                VALIDATION: 'Revisa los datos del perfil: hay campos con formato inválido.',
                DEFAULT: 'La información proporcionada no es válida.'
            });
        }


        if (status === 401) {

            return (
                'Tu sesión ya no es válida. Inicia sesión nuevamente.'
            );
        }


        if (status === 403) {

            return isUpdate

                ? 'No tienes autorización para modificar este perfil.'

                : 'No tienes autorización para consultar este perfil.';
        }


        if (status === 404) {

            return (
                'No fue posible encontrar la información del perfil.'
            );
        }


        if (status === 409) {

            // El backend responde 409 también cuando no encuentra el registro (CT_004).
            return toUserMessage(error, {
                CT_004: 'No fue posible encontrar la información del perfil.',
                AT_003: isUpdate
                    ? 'No tienes autorización para modificar este perfil.'
                    : 'No tienes autorización para consultar este perfil.',
                DEFAULT: 'La información proporcionada ya está registrada.'
            });
        }


        if (status >= 500) {

            return isUpdate

                ? 'El servidor no pudo actualizar tu perfil. Inténtalo nuevamente.'

                : 'El servidor no pudo cargar tu perfil. Inténtalo nuevamente.';
        }


        switch (
            error?.message
        ) {

            case 'SESSION_NOT_FOUND':

                return (
                    'No existe una sesión activa.'
                );


            case 'CLIENT_PROFILE_NOT_FOUND':

                return (
                    'No se encontró el perfil del cliente.'
                );


            case 'PROFILE_EDIT_NOT_AVAILABLE':

                return (
                    'Esta cuenta no tiene habilitada la edición de perfil.'
                );


            default:

                return isUpdate

                    ? 'No fue posible actualizar tu perfil. Inténtalo nuevamente.'

                    : 'No fue posible cargar tu perfil. Inténtalo nuevamente.';
        }
    }
}