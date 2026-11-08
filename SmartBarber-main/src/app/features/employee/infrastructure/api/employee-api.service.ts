import {
    Injectable,
    inject
} from '@angular/core';

import {
    HttpClient,
    HttpErrorResponse,
    HttpHeaders
} from '@angular/common/http';

import {
    Observable,
    catchError,
    map,
    of,
    throwError
} from 'rxjs';

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

/** Código con el que el backend responde "empleado no encontrado" (HTTP 409). */
const EMPLOYEE_NOT_FOUND_CODE = 'CT_004';

@Injectable({
    providedIn: 'root'
})
export class EmployeeApiService
    extends EmployeeRepository {

    private readonly http =
        inject(HttpClient);

    private readonly baseUrl =
        environment.apiUrl;

    /**
     * El backend identifica la cuenta nueva con el token que llega en
     * Authorization, por eso aquí va el token del barbero y no el del
     * administrador (el interceptor no lo reemplaza si ya existe).
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
                        Authorization: `Bearer ${employeeIdToken}`,
                        idToken: `Bearer ${employeeIdToken}`
                    })
                }
            )
            .pipe(
                map(response => mapOnboardingResponse(
                    response,
                    request.barberiaId
                ))
            );
    }

    override getEmployeesByBarbershop(
        barberiaId: string
    ): Observable<Employee[]> {

        return this.http
            .get<EmployeeResponse[] | null>(
                `${this.baseUrl}/public/employee-service/barbershop/${encodeURIComponent(barberiaId)}`
            )
            .pipe(
                map(response =>
                    (Array.isArray(response) ? response : [])
                        .map(mapEmployeeResponse)
                ),
                // Sin barberos, el backend responde "no encontrado".
                catchError(error => isNotFound(error) ? of([]) : throwError(() => error))
            );
    }

    override findByDocument(
        document: string
    ): Observable<Employee | null> {
        return this.findOne(
            `${this.baseUrl}/employee-service/documento/${encodeURIComponent(document)}`
        );
    }

    override findByName(
        name: string
    ): Observable<Employee | null> {
        return this.findOne(
            `${this.baseUrl}/employee-service/nombre/${encodeURIComponent(name)}`
        );
    }

    private findOne(url: string): Observable<Employee | null> {
        return this.http
            .get<EmployeeResponse | null>(url)
            .pipe(
                map(response => response ? mapEmployeeResponse(response) : null),
                catchError(error => isNotFound(error) ? of(null) : throwError(() => error))
            );
    }
}

function isNotFound(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse)) {
        return false;
    }

    const code = (error.error as { data?: { code?: unknown } } | null)?.data?.code;

    return error.status === 404 || code === EMPLOYEE_NOT_FOUND_CODE;
}
