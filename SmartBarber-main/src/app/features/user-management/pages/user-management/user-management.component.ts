import {
    Component,
    ViewChild,
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
    takeUntilDestroyed
} from '@angular/core/rxjs-interop';

import {
    ValidatorFn
} from '@angular/forms';

import {
    EmployeeSearchCriterion,
    SearchEmployeeUseCase
} from '../../../employee/application/use-cases/search-employee.use-case';

import {
    normalizeDocument,
    normalizeText,
    personNameValidator,
    validationMessage
} from '../../../../shared/forms/colombia-validators';

import {
    toApiError
} from '../../../../core/errors';

type SearchCriterion = EmployeeSearchCriterion | 'USER_ID';

interface SearchCopy {
    label: string;
    placeholder: string;
    hint: string;
    required: string;
}

const SEARCH_COPY: Record<SearchCriterion, SearchCopy> = {
    DOCUMENT: {
        label: 'Número de documento',
        placeholder: 'Ej. 1012345678',
        hint: 'Cédula del barbero, solo números.',
        required: 'Ingresa el número de documento.'
    },
    NAME: {
        label: 'Nombre completo',
        placeholder: 'Ej. Carlos Pérez',
        hint: 'Escribe el nombre exactamente como fue registrado.',
        required: 'Ingresa el nombre del barbero.'
    },
    USER_ID: {
        label: 'ID del usuario',
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        hint: 'Identificador único del usuario en SmartBarber.',
        required: 'Ingresa el ID del usuario.'
    }
};

/** Documento: 3 a 10 dígitos; se aceptan puntos y espacios al escribir. */
const documentSearchValidator: ValidatorFn = control =>
    /^\d{3,10}$/.test(String(control.value ?? '').replace(/[.\s-]/g, ''))
        ? null
        : { searchDocument: true };

const SEARCH_VALIDATORS: Record<SearchCriterion, ValidatorFn[]> = {
    DOCUMENT: [Validators.required, documentSearchValidator],
    NAME: [Validators.required, Validators.maxLength(120), personNameValidator()],
    USER_ID: [Validators.required, Validators.pattern(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)]
};

import {
    GetUserUseCase
} from '../../application/use-cases/get-user.use-case';

import {
    BlockUserUseCase
} from '../../application/use-cases/block-user.use-case';

import {
    ManagedUser
} from '../../domain/models/user-management.model';

import {
    EmployeeRegisterComponent
} from '../../../employee/components/employee-register/employee-register.component';

import {
    EmployeeListComponent
} from '../../../employee/components/employee-list/employee-list.component';

import {
    Employee
} from '../../../employee/domain/models/employee.model';

import {
    SessionService
} from '../../../../core/auth/services/session.service';


@Component({
    selector: 'app-user-management',

    standalone: true,

    imports: [
        CommonModule,
        ReactiveFormsModule,
        EmployeeRegisterComponent,
        EmployeeListComponent
    ],

    templateUrl:
        './user-management.component.html',

    styleUrl:
        './user-management.component.css'
})
export class UserManagementComponent {


    private readonly formBuilder =
        inject(FormBuilder);


    private readonly getUserUseCase =
        inject(GetUserUseCase);


    private readonly blockUserUseCase =
        inject(BlockUserUseCase);

    private readonly sessionService =
        inject(SessionService);

    private readonly searchEmployeeUseCase =
        inject(SearchEmployeeUseCase);


    @ViewChild(EmployeeListComponent)
    private employeeList?: EmployeeListComponent;

    readonly users =
        signal<ManagedUser[]>([]);

    readonly showEmployeeRegistration =
        signal(false);


    readonly selectedUser =
        signal<ManagedUser | null>(
            null
        );


    readonly loading =
        signal(false);


    readonly searching =
        signal(false);


    readonly blocking =
        signal(false);


    readonly errorMessage =
        signal('');


    readonly successMessage =
        signal('');

    /** Confirmación del registro de un barbero (se muestra junto al equipo). */
    readonly teamMessage =
        signal('');


    readonly showBlockDialog =
        signal(false);


    /** Barbero encontrado con la búsqueda por documento o nombre. */
    readonly foundEmployee =
        signal<Employee | null>(null);

    readonly searchForm =
        this.formBuilder
            .nonNullable
            .group({

                criterion: [
                    'DOCUMENT' as SearchCriterion
                ],

                term: [
                    '',
                    SEARCH_VALIDATORS.DOCUMENT
                ]
            });


    readonly blockForm =
        this.formBuilder
            .nonNullable
            .group({

                reason: [
                    '',
                    [
                        Validators.required,
                        Validators.minLength(5),
                        Validators.maxLength(500)
                    ]
                ]
            });

    constructor() {
        this.searchForm.controls.criterion.valueChanges
            .pipe(takeUntilDestroyed())
            .subscribe(criterion => {
                const term = this.searchForm.controls.term;
                term.setValidators(SEARCH_VALIDATORS[criterion]);
                term.setValue('');
                term.markAsUntouched();
                this.foundEmployee.set(null);
                this.errorMessage.set('');
            });
    }

    get barberiaId(): string {
        return this.sessionService.getBarbershopId() ?? '';
    }

    get currentEmployeeId(): string | null {
        return this.sessionService.getBarberId();
    }

    openEmployeeRegistration(): void {
        this.errorMessage.set('');
        this.successMessage.set('');
        this.teamMessage.set('');

        if (!this.barberiaId) {
            this.errorMessage.set(
                'La sesión no contiene el identificador de la barbería. Vuelve a iniciar sesión o contacta con soporte.'
            );

            return;
        }

        this.showEmployeeRegistration.set(true);
    }

    closeEmployeeRegistration(): void {
        this.showEmployeeRegistration.set(false);
    }

    onEmployeeRegistered(employee: Employee): void {
        this.showEmployeeRegistration.set(false);
        this.employeeList?.reload();
        this.teamMessage.set(
            `${employee.name} fue registrado y podrá iniciar sesión con la cuenta de Google vinculada.`
        );
    }


    get searchCriterion(): SearchCriterion {
        return this.searchForm.controls.criterion.value;
    }

    get searchCopy(): SearchCopy {
        return SEARCH_COPY[this.searchCriterion];
    }

    get searchTermError(): string | null {
        return validationMessage(this.searchForm.controls.term, {
            required: this.searchCopy.required,
            pattern: 'Ingresa un ID de usuario válido (formato UUID).',
            searchDocument: 'El documento debe tener entre 3 y 10 dígitos, sin letras.'
        });
    }

    /** Botón "Consultar": decide la búsqueda según el criterio elegido. */
    search(): void {

        this.errorMessage.set('');
        this.successMessage.set('');

        if (this.searchForm.invalid) {
            this.searchForm.markAllAsTouched();
            return;
        }

        const criterion = this.searchCriterion;
        const term = this.searchForm.controls.term.value;

        if (criterion === 'USER_ID') {
            this.foundEmployee.set(null);
            this.searchUser(term.trim());
            return;
        }

        this.searchEmployee(criterion, term);
    }

    private searchEmployee(
        criterion: EmployeeSearchCriterion,
        rawTerm: string
    ): void {
        const term = criterion === 'DOCUMENT'
            ? normalizeDocument('CC', rawTerm)
            : normalizeText(rawTerm);

        this.selectedUser.set(null);
        this.foundEmployee.set(null);
        this.searching.set(true);

        this.searchEmployeeUseCase
            .execute(criterion, term, this.barberiaId)
            .pipe(
                finalize(() => this.searching.set(false))
            )
            .subscribe({
                next: employee => {
                    if (!employee) {
                        this.errorMessage.set(
                            criterion === 'DOCUMENT'
                                ? `No hay un barbero de tu barbería con el documento ${term}.`
                                : `No hay un barbero de tu barbería llamado "${term}". Escribe el nombre completo tal como fue registrado.`
                        );
                        return;
                    }

                    this.foundEmployee.set(employee);
                },
                error: error => {
                    this.errorMessage.set(
                        toApiError(error, {
                            HTTP_401: 'Tu sesión expiró. Vuelve a iniciar sesión para consultar barberos.',
                            TECH_005: 'El servidor no pudo completar la búsqueda. Si buscas por nombre, puede haber más de un barbero con ese nombre: intenta con el documento.',
                            DEFAULT: 'No fue posible consultar el barbero. Inténtalo nuevamente.'
                        }).message
                    );
                }
            });
    }

    private searchUser(userId: string): void {


        this.searching.set(
            true
        );


        this.getUserUseCase
            .execute(userId)

            .pipe(
                finalize(() =>
                    this.searching.set(
                        false
                    )
                )
            )

            .subscribe({

                next: user => {

                    this.selectedUser.set(
                        user
                    );


                    this.addOrReplaceUser(
                        user
                    );
                },


                error: error => {

                    this.selectedUser.set(
                        null
                    );


                    this.errorMessage.set(
                        this.getErrorMessage(
                            error
                        )
                    );
                }
            });
    }


    openBlockDialog(
        user: ManagedUser
    ): void {

        this.errorMessage.set('');
        this.successMessage.set('');


        if (
            user.status ===
            'BLOCKED'
        ) {

            this.errorMessage.set(
                'El usuario ya se encuentra bloqueado.'
            );

            return;
        }


        this.selectedUser.set(
            user
        );


        this.blockForm.reset();


        this.showBlockDialog.set(
            true
        );
    }


    closeBlockDialog(): void {

        if (
            this.blocking()
        ) {

            return;
        }


        this.showBlockDialog.set(
            false
        );


        this.blockForm.reset();
    }


    confirmBlock(): void {

        this.errorMessage.set('');
        this.successMessage.set('');


        const user =
            this.selectedUser();


        if (!user) {

            return;
        }


        if (
            this.blockForm.invalid
        ) {

            this.blockForm.markAllAsTouched();

            return;
        }


        const reason =
            this.blockForm
                .controls
                .reason
                .value
                .trim();


        this.blocking.set(
            true
        );


        this.blockUserUseCase
            .execute(
                user,
                reason
            )

            .pipe(
                finalize(() =>
                    this.blocking.set(
                        false
                    )
                )
            )

            .subscribe({

                next: updatedUser => {

                    const normalizedUser:
                        ManagedUser = {

                        ...updatedUser,

                        status:
                            'BLOCKED'
                    };


                    this.selectedUser.set(
                        normalizedUser
                    );


                    this.replaceUser(
                        normalizedUser
                    );


                    this.showBlockDialog.set(
                        false
                    );


                    this.blockForm.reset();


                    this.successMessage.set(
                        'El usuario fue marcado como bloqueado.'
                    );
                },


                error: error => {

                    this.errorMessage.set(
                        this.getBlockErrorMessage(
                            error
                        )
                    );
                }
            });
    }


    getStatusLabel(
        status: string
    ): string {

        switch (
        status.toUpperCase()
        ) {

            case 'ACTIVE':
            case 'ACTIVO':
                return 'Activo';

            case 'BLOCKED':
            case 'BLOQUEADO':
                return 'Bloqueado';

            case 'INACTIVE':
            case 'INACTIVO':
                return 'Inactivo';

            default:
                return status;
        }
    }


    isBlocked(
        user: ManagedUser
    ): boolean {

        const status =
            user.status
                .toUpperCase();


        return (
            status ===
            'BLOCKED' ||
            status ===
            'BLOQUEADO'
        );
    }


    private addOrReplaceUser(
        user: ManagedUser
    ): void {

        const existingIndex =
            this.users()
                .findIndex(
                    current =>
                        current.id ===
                        user.id
                );


        if (
            existingIndex === -1
        ) {

            this.users.update(
                current => [
                    user,
                    ...current
                ]
            );

            return;
        }


        this.replaceUser(
            user
        );
    }


    private replaceUser(
        user: ManagedUser
    ): void {

        this.users.update(
            current =>
                current.map(
                    item =>
                        item.id === user.id
                            ? user
                            : item
                )
        );
    }


    private getErrorMessage(
        error: unknown
    ): string {

        const httpError =
            error as {
                status?: number
            };


        if (
            httpError?.status === 403
        ) {

            return (
                'El servidor solo permite consultar usuarios a cuentas con rol de barbero; con una cuenta de administrador esta consulta no está disponible.'
            );
        }


        if (
            httpError?.status === 404
        ) {

            return (
                'No se encontró el usuario solicitado.'
            );
        }


        if (
            httpError?.status === 400
        ) {

            return (
                'Los datos enviados para consultar el usuario no son válidos.'
            );
        }


        return (
            'No fue posible consultar el usuario. Inténtalo nuevamente.'
        );
    }


    private getBlockErrorMessage(
        error: unknown
    ): string {

        const message =
            error instanceof Error
                ? error.message
                : '';


        switch (message) {

            case 'SESSION_NOT_FOUND':
                return (
                    'La sesión actual no está disponible.'
                );

            case 'UNAUTHORIZED_ROLE':
                return (
                    'Solo un administrador puede bloquear usuarios.'
                );

            case 'USER_ALREADY_BLOCKED':
                return (
                    'El usuario ya se encuentra bloqueado.'
                );

            case 'BLOCK_REASON_REQUIRED':
                return (
                    'Debes indicar el motivo del bloqueo.'
                );

            default:
                return (
                    'No fue posible bloquear el usuario. Verifica la información e inténtalo nuevamente.'
                );
        }
    }





    get reasonControl() {
        return this.blockForm.controls.reason;
    }
}