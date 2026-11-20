import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { EmployeeRepository } from '../../domain/repositories/employee.repository';
import { Employee } from '../../domain/models/employee.model';
import { EmployeeDataChange, TeamMember } from '../../domain/models/team-member.model';

/** Celular colombiano: 10 dígitos (la misma regla del backend). */
const CELL_PATTERN = /^[0-9]{10}$/;

export const EMPLOYEE_NAME_MAX = 100;
export const EMPLOYEE_SPECIALTY_MAX = 200;

/** Errores de validación por campo; vacío si el cambio es válido. */
export type EmployeeChangeErrors = Partial<Record<keyof EmployeeDataChange, string>>;

/** Limpia espacios repetidos y normaliza la lista de especialidades. */
export function normalizeChange(change: EmployeeDataChange): EmployeeDataChange {
    return {
        name: change.name.replace(/\s+/g, ' ').trim(),
        cell: change.cell.replace(/\D/g, ''),
        specialty: change.specialty
            .split(',')
            .map(item => item.replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .join(', ')
    };
}

export function validateChange(change: EmployeeDataChange): EmployeeChangeErrors {
    const errors: EmployeeChangeErrors = {};

    if (!change.name) {
        errors.name = 'Escribe el nombre del barbero.';
    } else if (change.name.length > EMPLOYEE_NAME_MAX) {
        errors.name = `El nombre admite máximo ${EMPLOYEE_NAME_MAX} caracteres.`;
    }

    if (!CELL_PATTERN.test(change.cell)) {
        errors.cell = 'El celular debe tener exactamente 10 dígitos.';
    }

    if (!change.specialty) {
        errors.specialty = 'Escribe al menos una especialidad.';
    } else if (change.specialty.length > EMPLOYEE_SPECIALTY_MAX) {
        errors.specialty = `Las especialidades admiten máximo ${EMPLOYEE_SPECIALTY_MAX} caracteres.`;
    }

    return errors;
}

/** El administrador corrige el nombre, el celular y las especialidades de un barbero. */
@Injectable()
export class UpdateEmployeeUseCase {

    private readonly employeeRepository =
        inject(EmployeeRepository);

    /** Solo se pueden editar barberos con cuenta asociada (el backend exige el userId). */
    canEdit(member: TeamMember): boolean {
        return member.role !== 'ADMIN' && Boolean(member.userId);
    }

    execute(member: TeamMember, change: EmployeeDataChange): Observable<Employee> {
        return this.employeeRepository.updateEmployee(member, normalizeChange(change));
    }
}
