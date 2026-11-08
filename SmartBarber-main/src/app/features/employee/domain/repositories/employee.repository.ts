import {
    Observable
} from 'rxjs';

import {
    Employee
} from '../models/employee.model';

import {
    EmployeeRegistration
} from '../models/employee-registration.model';

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

    /** Equipo de una barbería. Lista vacía si no tiene barberos. */
    abstract getEmployeesByBarbershop(
        barberiaId: string
    ): Observable<Employee[]>;

    /** Barbero por número de documento, o null si no existe. */
    abstract findByDocument(
        document: string
    ): Observable<Employee | null>;

    /** Barbero por nombre exacto, o null si no existe. */
    abstract findByName(
        name: string
    ): Observable<Employee | null>;
}
