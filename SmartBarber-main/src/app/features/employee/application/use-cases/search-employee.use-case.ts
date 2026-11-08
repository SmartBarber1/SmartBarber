import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { EmployeeRepository } from '../../domain/repositories/employee.repository';
import { Employee } from '../../domain/models/employee.model';

export type EmployeeSearchCriterion = 'DOCUMENT' | 'NAME';

/**
 * Busca barberos de la barbería del administrador.
 *
 * - DOCUMENT: usa GET /employee-service/documento/{documento}. El backend busca
 *   en todas las barberías, así que se descarta lo que no sea de esta barbería.
 * - NAME: el endpoint /employee-service/nombre/{nombre} del backend exige el
 *   nombre exacto (distingue mayúsculas), por eso se consulta el equipo de la
 *   barbería y se filtra aquí sin distinguir mayúsculas, minúsculas ni tildes,
 *   aceptando coincidencias parciales ("carlos" encuentra "Carlos Pérez").
 */
@Injectable()
export class SearchEmployeeUseCase {

    private readonly employeeRepository =
        inject(EmployeeRepository);

    execute(
        criterion: EmployeeSearchCriterion,
        value: string,
        barberiaId: string
    ): Observable<Employee[]> {
        if (criterion === 'DOCUMENT') {
            return this.employeeRepository
                .findByDocument(value)
                .pipe(
                    map(employee =>
                        employee && employee.barberiaId === barberiaId
                            ? [employee]
                            : []
                    )
                );
        }

        const term = normalizeForSearch(value);

        return this.employeeRepository
            .getEmployeesByBarbershop(barberiaId)
            .pipe(
                map(employees =>
                    employees
                        .filter(employee => normalizeForSearch(employee.name).includes(term))
                        .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
                )
            );
    }
}

/** Minúsculas, sin tildes y con espacios simples: "  JOSÉ  Pérez" → "jose perez". */
export function normalizeForSearch(value: string | null | undefined): string {
    return (value ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}
