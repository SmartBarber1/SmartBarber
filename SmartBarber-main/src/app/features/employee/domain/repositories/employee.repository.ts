import {
    Observable
} from 'rxjs';

import {
    Employee
} from '../models/employee.model';

import {
    EmployeeRegistration
} from '../models/employee-registration.model';

import {
    AccessAction,
    EmployeeDataChange,
    TeamMember
} from '../models/team-member.model';

/**
 * Puerto del dominio de barberos. La interfaz no conoce URLs ni cabeceras:
 * eso es responsabilidad de la implementación en infrastructure/.
 */
export abstract class EmployeeRepository {

    /**
     * Registra un barbero.
     * @param employeeIdToken token de la cuenta de Google que usará el barbero.
     */
    abstract createEmployee(
        request: EmployeeRegistration,
        employeeIdToken: string
    ): Observable<Employee>;

    /** Barberos de una barbería (listado público). Lista vacía si no tiene barberos. */
    abstract getEmployeesByBarbershop(
        barberiaId: string
    ): Observable<Employee[]>;

    /**
     * Equipo de la barbería del administrador autenticado, con el estado de
     * cada cuenta. La barbería la toma el backend de la sesión.
     */
    abstract getTeam(): Observable<TeamMember[]>;

    /**
     * Bloquea o desbloquea la cuenta de un barbero y devuelve su nuevo estado.
     * @param reason motivo (obligatorio para bloquear).
     */
    abstract changeAccess(
        employeeId: string,
        action: AccessAction,
        reason: string | null
    ): Observable<TeamMember>;

    /**
     * Corrige el nombre, el celular y las especialidades de un barbero.
     * Los demás datos (documento, correo, cuenta) se envían sin cambios.
     */
    abstract updateEmployee(
        member: TeamMember,
        change: EmployeeDataChange
    ): Observable<Employee>;

    /** Barbero por número de documento, o null si no existe. */
    abstract findByDocument(
        document: string
    ): Observable<Employee | null>;
}
