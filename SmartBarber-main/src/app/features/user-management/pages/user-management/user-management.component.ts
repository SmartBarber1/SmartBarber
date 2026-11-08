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
    ValidatorFn,
    Validators
} from '@angular/forms';

import {
    takeUntilDestroyed
} from '@angular/core/rxjs-interop';

import {
    finalize
} from 'rxjs';

import {
    EmployeeSearchCriterion,
    SearchEmployeeUseCase
} from '../../../employee/application/use-cases/search-employee.use-case';

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

import {
    normalizeDocument,
    normalizeText,
    validationMessage
} from '../../../../shared/forms/colombia-validators';

import {
    toApiError
} from '../../../../core/errors';

interface SearchCopy {
    label: string;
    placeholder: string;
    hint: string;
    required: string;
}

const SEARCH_COPY: Record<EmployeeSearchCriterion, SearchCopy> = {
    DOCUMENT: {
        label: 'Número de documento',
        placeholder: 'Ej. 1012345678',
        hint: 'Cédula del barbero, solo números.',
        required: 'Ingresa el número de documento.'
    },
    NAME: {
        label: 'Nombre',
        placeholder: 'Ej. carlos o Carlos Pérez',
        hint: 'No importan mayúsculas, minúsculas ni tildes; puedes escribir solo una parte del nombre.',
        required: 'Ingresa el nombre del barbero.'
    }
};

/** Documento: 3 a 10 dígitos; se aceptan puntos y espacios al escribir. */
const documentSearchValidator: ValidatorFn = control =>
    /^\d{3,10}$/.test(String(control.value ?? '').replace(/[.\s-]/g, ''))
        ? null
        : { searchDocument: true };

/** Nombre: al menos 2 letras; solo letras, espacios, apóstrofes, puntos y guiones. */
const nameSearchValidator: ValidatorFn = control => {
    const value = String(control.value ?? '').trim();

    return /^[\p{L}][\p{L} .'-]*$/u.test(value) && value.replace(/[^\p{L}]/gu, '').length >= 2
        ? null
        : { searchName: true };
};

const SEARCH_VALIDATORS: Record<EmployeeSearchCriterion, ValidatorFn[]> = {
    DOCUMENT: [Validators.required, documentSearchValidator],
    NAME: [Validators.required, Validators.maxLength(120), nameSearchValidator]
};


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

    private readonly sessionService =
        inject(SessionService);

    private readonly searchEmployeeUseCase =
        inject(SearchEmployeeUseCase);

    @ViewChild(EmployeeListComponent)
    private employeeList?: EmployeeListComponent;

    readonly showEmployeeRegistration =
        signal(false);

    readonly searching =
        signal(false);

    readonly errorMessage =
        signal('');

    /** Confirmación del registro de un barbero (se muestra junto al equipo). */
    readonly teamMessage =
        signal('');

    /** Barberos encontrados con la búsqueda por documento o nombre. */
    readonly foundEmployees =
        signal<Employee[]>([]);

    readonly searchForm =
        this.formBuilder
            .nonNullable
            .group({

                criterion: [
                    'DOCUMENT' as EmployeeSearchCriterion
                ],

                term: [
                    '',
                    SEARCH_VALIDATORS.DOCUMENT
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
                this.foundEmployees.set([]);
                this.errorMessage.set('');
            });
    }

    get barberiaId(): string {
        return this.sessionService.getBarbershopId() ?? '';
    }

    get currentEmployeeId(): string | null {
        return this.sessionService.getBarberId();
    }

    get searchCriterion(): EmployeeSearchCriterion {
        return this.searchForm.controls.criterion.value;
    }

    get searchCopy(): SearchCopy {
        return SEARCH_COPY[this.searchCriterion];
    }

    get searchTermError(): string | null {
        return validationMessage(this.searchForm.controls.term, {
            required: this.searchCopy.required,
            searchDocument: 'El documento debe tener entre 3 y 10 dígitos, sin letras.',
            searchName: 'Escribe al menos 2 letras, sin números ni símbolos.'
        });
    }

    openEmployeeRegistration(): void {
        this.errorMessage.set('');
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

    /** Botón "Consultar": busca por documento o por nombre. */
    search(): void {
        this.errorMessage.set('');

        if (this.searchForm.invalid) {
            this.searchForm.markAllAsTouched();
            return;
        }

        const criterion = this.searchCriterion;
        const rawTerm = this.searchForm.controls.term.value;
        const term = criterion === 'DOCUMENT'
            ? normalizeDocument('CC', rawTerm)
            : normalizeText(rawTerm);

        this.foundEmployees.set([]);
        this.searching.set(true);

        this.searchEmployeeUseCase
            .execute(criterion, term, this.barberiaId)
            .pipe(
                finalize(() => this.searching.set(false))
            )
            .subscribe({
                next: employees => {
                    if (employees.length === 0) {
                        this.errorMessage.set(
                            criterion === 'DOCUMENT'
                                ? `No hay un barbero de tu barbería con el documento ${term}.`
                                : `No hay barberos de tu barbería cuyo nombre contenga "${term}".`
                        );
                        return;
                    }

                    this.foundEmployees.set(employees);
                },
                error: error => {
                    this.errorMessage.set(
                        toApiError(error, {
                            HTTP_401: 'Tu sesión expiró. Vuelve a iniciar sesión para consultar barberos.',
                            DEFAULT: 'No fue posible consultar el barbero. Inténtalo nuevamente.'
                        }).message
                    );
                }
            });
    }

    documentLabel(employee: Employee): string {
        return employee.documentType === 'CE' ? 'C.E.' : 'C.C.';
    }
}
