import {
    Employee
} from '../../domain/models/employee.model';

import {
    EmployeeRegistrationResponse
} from '../../domain/models/employee-registration.model';

/** Respuesta de GET /employee-service/barbershop/{id} (EmployeeRsDto). */
export interface EmployeeResponse {
    id: string;
    userId: string | null;
    barberiaId: string;
    document: string | null;
    documentType: 'CC' | 'CE' | null;
    name: string | null;
    cell: string | null;
    email: string | null;
    specialty: string | null;
    createAt: string | null;
    updateAt?: string | null;
}

export function mapEmployeeResponse(response: EmployeeResponse): Employee {
    return {
        id: response.id,
        userId: response.userId ?? '',
        barberiaId: response.barberiaId,
        document: response.document ?? '',
        documentType: response.documentType ?? 'CC',
        name: response.name?.trim() || 'Sin nombre',
        cell: response.cell ?? '',
        email: response.email ?? '',
        specialty: response.specialty ?? '',
        createAt: response.createAt ?? '',
        updateAt: response.updateAt ?? null
    };
}

export function mapOnboardingResponse(response: EmployeeRegistrationResponse): Employee {
    return {
        id: response.id,
        userId: response.user.id,
        barberiaId: response.barberiaId,
        document: response.document,
        documentType: response.documentType,
        name: response.name,
        cell: response.cell,
        email: response.email,
        specialty: response.specialty,
        createAt: response.createAt,
        updateAt: response.updateAt ?? null
    };
}
