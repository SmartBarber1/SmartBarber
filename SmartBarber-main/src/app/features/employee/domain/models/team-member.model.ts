import { Employee } from './employee.model';

/** Estado de la cuenta de un miembro del equipo (`UNKNOWN`: sin cuenta asociada). */
export type AccountStatus = 'ACTIVE' | 'BLOCKED' | 'PENDING' | 'UNKNOWN';

export type TeamRole = 'ADMIN' | 'BARBER';

/** Barbero o administrador de la barbería con el estado de su cuenta. */
export interface TeamMember extends Employee {
    status: AccountStatus;
    role: TeamRole | null;
    /** Motivo del bloqueo vigente (RN-48); `null` si la cuenta no está bloqueada. */
    blockReason: string | null;
    /** Fecha ISO del bloqueo vigente. */
    blockedAt: string | null;
}

export type AccessAction = 'BLOCK' | 'UNBLOCK';

/** Longitud del motivo de bloqueo (la misma regla del backend, EY_005). */
export const BLOCK_REASON_MIN = 5;
export const BLOCK_REASON_MAX = 200;

/** Datos que el administrador puede corregir de un barbero. */
export interface EmployeeDataChange {
    name: string;
    cell: string;
    /** Especialidades separadas por coma. */
    specialty: string;
}
