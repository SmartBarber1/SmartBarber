import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    Input,
    OnChanges,
    SimpleChanges,
    inject,
    signal
} from '@angular/core';

import {
    DatePipe
} from '@angular/common';

import {
    takeUntilDestroyed
} from '@angular/core/rxjs-interop';

import {
    finalize
} from 'rxjs';

import {
    GetEmployeesByBarbershopUseCase
} from '../../application/use-cases/get-employees-by-barbershop.use-case';

import {
    Employee
} from '../../domain/models/employee.model';

import {
    toApiError
} from '../../../../core/errors';

const LIST_ERROR_MESSAGES = {
    DEFAULT: 'No fue posible cargar el equipo de la barbería.'
} as const;

/**
 * Muestra el equipo de la barbería tal como lo devuelve el backend.
 * Solo presenta datos: la consulta la hace el caso de uso.
 */
@Component({
    selector: 'app-employee-list',
    standalone: true,
    imports: [DatePipe],
    templateUrl: './employee-list.component.html',
    styleUrl: './employee-list.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeListComponent implements OnChanges {

    private readonly getEmployees =
        inject(GetEmployeesByBarbershopUseCase);

    private readonly destroyRef =
        inject(DestroyRef);

    @Input({ required: true })
    barberiaId = '';

    /** Empleado de la sesión actual, para marcarlo como "Tú". */
    @Input()
    currentEmployeeId: string | null = null;

    readonly employees = signal<Employee[]>([]);
    readonly loading = signal(false);
    readonly errorMessage = signal('');

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['barberiaId']) {
            this.reload();
        }
    }

    reload(): void {
        if (!this.barberiaId) {
            this.employees.set([]);
            return;
        }

        this.loading.set(true);
        this.errorMessage.set('');

        this.getEmployees
            .execute(this.barberiaId)
            .pipe(
                finalize(() => this.loading.set(false)),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe({
                next: employees => this.employees.set(employees),
                error: error => {
                    this.employees.set([]);
                    this.errorMessage.set(
                        toApiError(error, LIST_ERROR_MESSAGES).message
                    );
                }
            });
    }

    documentLabel(employee: Employee): string {
        return employee.documentType === 'CE' ? 'C.E.' : 'C.C.';
    }

    specialtiesOf(employee: Employee): string[] {
        return employee.specialty
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);
    }

    formatCell(cell: string): string {
        const digits = cell.replace(/\D/g, '');

        return digits.length === 10
            ? `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
            : cell;
    }
}
