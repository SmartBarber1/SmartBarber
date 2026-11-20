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
    AccessAction,
    EmployeeDataChange,
    TeamMember
} from '../../domain/models/team-member.model';

import {
    EmployeeResponse,
    TeamMemberResponse,
    mapEmployeeResponse,
    mapOnboardingResponse,
    mapTeamMemberResponse
} from '../mappers/employee.mapper';

/** Código con el que el backend responde "empleado no encontrado" (HTTP 409). */
const EMPLOYEE_NOT_FOUND_CODE = 'CT_004';

const ACCESS_PATH: Record<AccessAction, string> = {
    BLOCK: 'block-employee',
    UNBLOCK: 'unblock-employee'
};

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
     * Authorization: token del administrador (lo agrega el interceptor y el
     * backend verifica que sea ADMIN de esta barbería).
     * idToken: token de la cuenta de Google del barbero nuevo.
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

    override updateEmployee(
        member: TeamMember,
        change: EmployeeDataChange
    ): Observable<Employee> {
        // PUT /employee-service/actualizar-empleado/{id} (solo ADMIN) espera el registro completo.
        return this.http
            .put<EmployeeResponse>(
                `${this.baseUrl}/employee-service/actualizar-empleado/${encodeURIComponent(member.id)}`,
                {
                    barberiaId: member.barberiaId,
                    userId: member.userId,
                    document: member.document,
                    documentType: member.documentType,
                    email: member.email,
                    name: change.name,
                    cell: change.cell,
                    specialty: change.specialty
                }
            )
            .pipe(map(mapEmployeeResponse));
    }

    override getTeam(): Observable<TeamMember[]> {
        return this.http
            .get<TeamMemberResponse[] | null>(`${this.baseUrl}/employee-service/team`)
            .pipe(
                map(response =>
                    (Array.isArray(response) ? response : []).map(mapTeamMemberResponse)
                )
            );
    }

    override changeAccess(
        employeeId: string,
        action: AccessAction,
        reason: string | null
    ): Observable<TeamMember> {
        return this.http
            .patch<TeamMemberResponse>(
                `${this.baseUrl}/employee-service/${ACCESS_PATH[action]}/${encodeURIComponent(employeeId)}`,
                { reason }
            )
            .pipe(
                map(mapTeamMemberResponse)
            );
    }

    override findByDocument(
        document: string
    ): Observable<Employee | null> {
        return this.findOne(
            `${this.baseUrl}/employee-service/documento/${encodeURIComponent(document)}`
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
