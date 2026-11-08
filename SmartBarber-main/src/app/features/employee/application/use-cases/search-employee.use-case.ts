import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { EmployeeRepository } from '../../domain/repositories/employee.repository';
import { Employee } from '../../domain/models/employee.model';

export type EmployeeSearchCriterion = 'DOCUMENT' | 'NAME';

/**
 * Busca un barbero por documento o por nombre exacto.
 *
 * El backend busca en todas las barberías, así que aquí se descarta cualquier
 * resultado que no pertenezca a la barbería del administrador: para él es
 * equivalente a "no encontrado".
 */
@Injectable()
export class SearchEmployeeUseCase {

    private readonly employeeRepository =
        inject(EmployeeRepository);

    execute(
        criterion: EmployeeSearchCriterion,
        value: string,
        barberiaId: string
    ): Observable<Employee | null> {
        const search$ = criterion === 'DOCUMENT'
            ? this.employeeRepository.findByDocument(value)
            : this.employeeRepository.findByName(value);

        return search$.pipe(
            map(employee =>
                employee && employee.barberiaId === barberiaId
                    ? employee
                    : null
            )
        );
    }
}
