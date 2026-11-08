import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { EmployeeRepository } from '../../domain/repositories/employee.repository';
import { Employee } from '../../domain/models/employee.model';

@Injectable()
export class GetEmployeesByBarbershopUseCase {

    private readonly employeeRepository =
        inject(EmployeeRepository);

    /** Devuelve el equipo ordenado alfabéticamente por nombre. */
    execute(barberiaId: string): Observable<Employee[]> {
        return this.employeeRepository
            .getEmployeesByBarbershop(barberiaId)
            .pipe(
                map(employees =>
                    [...employees].sort((a, b) =>
                        a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
                    )
                )
            );
    }
}
