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
     * Registra un barbero en la barbería del administrador con sesión activa.
     * @param employeeIdToken token de la cuenta de Google que usará el barbero.
     */
    abstract createEmployee(
        request: EmployeeRegistration,
        employeeIdToken: string
    ): Observable<Employee>;

    /** Equipo completo de la barbería (solo disponible para su administrador). */
    abstract getEmployeesByBarbershop(
        barberiaId: string
    ): Observable<Employee[]>;
}
