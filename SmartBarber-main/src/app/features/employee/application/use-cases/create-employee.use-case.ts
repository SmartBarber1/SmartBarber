import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { EmployeeRepository } from '../../domain/repositories/employee.repository';
import { Employee } from '../../domain/models/employee.model';
import { EmployeeRegistration } from '../../domain/models/employee-registration.model';

@Injectable()
export class CreateEmployeeUseCase {

    private readonly employeeRepository =
        inject(EmployeeRepository);

    execute(
        request: EmployeeRegistration,
        employeeIdToken: string
    ): Observable<Employee> {
        return this.employeeRepository.createEmployee(
            request,
            employeeIdToken
        );
    }
}
