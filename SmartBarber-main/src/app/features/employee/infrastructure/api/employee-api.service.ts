import {
    Injectable,
    inject
} from '@angular/core';

import {
    HttpClient,
    HttpHeaders
} from '@angular/common/http';

import {
    Observable
} from 'rxjs';

import {
    map
} from 'rxjs/operators';

import {
    environment
} from '../../../../../environments/environment';

import {
    EmployeeRepository
} from '../../domain/repositories/employee.repository';

import {
    Employee
} from '../../domain/models/employee.model';

import {
    EmployeeRegistration,
    EmployeeRegistrationResponse
} from '../../domain/models/employee-registration.model';

import {
    EmployeeResponse,
    mapEmployeeResponse,
    mapOnboardingResponse
} from '../mappers/employee.mapper';

@Injectable({
    providedIn: 'root'
})
export class EmployeeApiService
    extends EmployeeRepository {

    private readonly http =
        inject(HttpClient);

    private readonly baseUrl =
        `${environment.apiUrl}`;

    /**
     * Authorization lo agrega el interceptor con el token del administrador.
     * idToken lleva el token de la cuenta de Google del nuevo barbero.
     */
    override createEmployee(
        request: EmployeeRegistration,
        employeeIdToken: string
    ): Observable<Employee> {

        return this.http
            .post<EmployeeRegistrationResponse>(
                `${this.baseUrl}/public/employee-service/onboarding`,
                request,
                {
                    headers: new HttpHeaders({
                        idToken: `Bearer ${employeeIdToken}`
                    })
                }
            )
            .pipe(
                map(mapOnboardingResponse)
            );
    }

    override getEmployeesByBarbershop(
        barberiaId: string
    ): Observable<Employee[]> {

        return this.http
            .get<EmployeeResponse[] | null>(
                `${this.baseUrl}/employee-service/barbershop/${encodeURIComponent(barberiaId)}`
            )
            .pipe(
                map(response =>
                    (Array.isArray(response) ? response : [])
                        .map(mapEmployeeResponse)
                )
            );
    }
}
