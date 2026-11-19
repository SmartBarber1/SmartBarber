import {
    Employee
} from '../../domain/models/employee.model';

import {
    EmployeeRegistrationResponse
} from '../../domain/models/employee-registration.model';

import {
    AccountStatus,
    TeamMember,
    TeamRole
} from '../../domain/models/team-member.model';

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

/** El backend no devuelve barberiaId en el onboarding: se toma de la solicitud. */
export function mapOnboardingResponse(
    response: EmployeeRegistrationResponse,
    requestedBarberiaId: string
): Employee {
    return {
        id: response.id,
        userId: response.user?.id ?? '',
        barberiaId: response.barberiaId ?? requestedBarberiaId,
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

/** Respuesta de GET /employee-service/team y de bloquear/desbloquear (TeamMemberRsDto). */
export interface TeamMemberResponse extends EmployeeResponse {
    status: string | null;
    role: string | null;
    blockReason?: string | null;
    blockedAt?: string | null;
}

const ACCOUNT_STATUSES: readonly AccountStatus[] = ['ACTIVE', 'BLOCKED', 'PENDING'];

const TEAM_ROLES: readonly TeamRole[] = ['ADMIN', 'BARBER'];

export function mapTeamMemberResponse(response: TeamMemberResponse): TeamMember {
    const status = ACCOUNT_STATUSES.find(value => value === response.status) ?? 'UNKNOWN';
    const role = TEAM_ROLES.find(value => value === response.role) ?? null;

    return {
        ...mapEmployeeResponse(response),
        status,
        role,
        blockReason: response.blockReason?.trim() || null,
        blockedAt: response.blockedAt ?? null
    };
}
