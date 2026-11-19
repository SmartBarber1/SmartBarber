import { Injectable, inject } from '@angular/core';
import { Observable, defer } from 'rxjs';

import { SessionService } from '../../../../core/auth/services/session.service';

import { EmployeeAccessError } from '../../domain/errors/employee-access.error';
import {
    AccessAction,
    BLOCK_REASON_MAX,
    BLOCK_REASON_MIN,
    TeamMember
} from '../../domain/models/team-member.model';
import { EmployeeRepository } from '../../domain/repositories/employee.repository';

/**
 * Bloquea o desbloquea la cuenta de un barbero. Repite en el cliente las reglas
 * del backend para avisar antes de llamar al API; el backend es quien decide.
 */
@Injectable()
export class ChangeEmployeeAccessUseCase {

    private readonly employeeRepository =
        inject(EmployeeRepository);

    private readonly sessionService =
        inject(SessionService);

    /** @param reason motivo; obligatorio para bloquear (RN-48). */
    execute(member: TeamMember, action: AccessAction, reason: string | null): Observable<TeamMember> {
        return defer(() => {
            this.validate(member, action);

            const normalizedReason = normalizeReason(reason);
            const reasonError = reasonProblem(action, normalizedReason);

            if (reasonError) {
                throw new EmployeeAccessError(reasonError);
            }

            return this.employeeRepository.changeAccess(member.id, action, normalizedReason);
        });
    }

    /** `null` si la acción está permitida; si no, el motivo para mostrarlo al usuario. */
    reasonNotAllowed(member: TeamMember, action: AccessAction): string | null {
        const session = this.sessionService.currentSession;

        if (!session || session.role !== 'ADMIN') {
            return 'Solo el administrador de la barbería puede bloquear o desbloquear barberos.';
        }
        if (member.id === this.sessionService.getBarberId()) {
            return 'No puedes bloquear ni desbloquear tu propia cuenta.';
        }
        if (member.role !== 'BARBER') {
            return 'Solo se puede bloquear o desbloquear a los barberos.';
        }
        if (action === 'BLOCK' && member.status === 'BLOCKED') {
            return `${member.name} ya está bloqueado.`;
        }
        if (action === 'UNBLOCK' && member.status !== 'BLOCKED') {
            return `${member.name} no está bloqueado.`;
        }
        return null;
    }

    private validate(member: TeamMember, action: AccessAction): void {
        const reason = this.reasonNotAllowed(member, action);

        if (reason) {
            throw new EmployeeAccessError(reason);
        }
    }
}

/** Espacios simples y sin bordes; `null` si queda vacío. */
export function normalizeReason(value: string | null | undefined): string | null {
    const normalized = (value ?? '').trim().replace(/\s+/g, ' ');

    return normalized || null;
}

/** Mensaje si el motivo no es válido para la acción; `null` si lo es. */
export function reasonProblem(action: AccessAction, reason: string | null): string | null {
    if (action === 'BLOCK' && (!reason || reason.length < BLOCK_REASON_MIN)) {
        return `Escribe el motivo del bloqueo (mínimo ${BLOCK_REASON_MIN} caracteres).`;
    }
    if (reason && reason.length > BLOCK_REASON_MAX) {
        return `El motivo no puede superar ${BLOCK_REASON_MAX} caracteres.`;
    }
    return null;
}
