import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    Input,
    OnChanges,
    SimpleChanges,
    inject,
    signal
} from '@angular/core';

import {
    DatePipe
} from '@angular/common';

import {
    takeUntilDestroyed
} from '@angular/core/rxjs-interop';

import {
    finalize
} from 'rxjs';

import {
    GetTeamUseCase
} from '../../application/use-cases/get-team.use-case';

import {
    ChangeEmployeeAccessUseCase,
    normalizeReason,
    reasonProblem
} from '../../application/use-cases/change-employee-access.use-case';

import {
    EmployeeAccessError
} from '../../domain/errors/employee-access.error';

import {
    AccessAction,
    AccountStatus,
    BLOCK_REASON_MAX,
    TeamMember
} from '../../domain/models/team-member.model';

import {
    toApiError
} from '../../../../core/errors';

const LIST_ERROR_MESSAGES = {
    DEFAULT: 'No fue posible cargar el equipo de la barbería.'
} as const;

const ACCESS_ERROR_MESSAGES = {
    HTTP_401: 'Tu sesión expiró. Vuelve a iniciar sesión para gestionar el equipo.',
    DEFAULT: 'No fue posible cambiar el acceso del barbero. Inténtalo nuevamente.'
} as const;

const STATUS_LABELS: Record<AccountStatus, string> = {
    ACTIVE: 'Activo',
    BLOCKED: 'Bloqueado',
    PENDING: 'Pendiente',
    UNKNOWN: 'Sin cuenta'
};

interface PendingAccessChange {
    memberId: string;
    action: AccessAction;
}

interface AccessFeedback {
    kind: 'success' | 'error';
    text: string;
}

/**
 * Equipo de la barbería con el estado de cada cuenta. El administrador puede
 * bloquear o desbloquear a sus barberos; cada cambio se confirma en la misma fila.
 */
@Component({
    selector: 'app-employee-list',
    standalone: true,
    imports: [DatePipe],
    templateUrl: './employee-list.component.html',
    styleUrl: './employee-list.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeListComponent implements OnChanges {

    private readonly getTeam =
        inject(GetTeamUseCase);

    private readonly changeAccess =
        inject(ChangeEmployeeAccessUseCase);

    private readonly destroyRef =
        inject(DestroyRef);

    /** Barbería de la sesión: al cambiar se vuelve a consultar el equipo. */
    @Input({ required: true })
    barberiaId = '';

    /** Empleado de la sesión actual, para marcarlo como "Tú". */
    @Input()
    currentEmployeeId: string | null = null;

    readonly employees = signal<TeamMember[]>([]);
    readonly loading = signal(false);
    readonly errorMessage = signal('');

    /** Cambio de acceso que espera confirmación. */
    readonly pendingChange = signal<PendingAccessChange | null>(null);

    /** Barbero cuyo cambio de acceso se está enviando. */
    readonly processingId = signal<string | null>(null);

    readonly feedback = signal<AccessFeedback | null>(null);

    /** Motivo que escribe el administrador en la confirmación. */
    readonly reasonDraft = signal('');

    /** Error del motivo; solo se muestra después de intentar confirmar. */
    readonly reasonError = signal<string | null>(null);

    readonly reasonMax = BLOCK_REASON_MAX;

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['barberiaId']) {
            this.reload();
        }
    }

    reload(): void {
        if (!this.barberiaId) {
            this.employees.set([]);
            return;
        }

        this.loading.set(true);
        this.errorMessage.set('');
        this.pendingChange.set(null);

        this.getTeam
            .execute()
            .pipe(
                finalize(() => this.loading.set(false)),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe({
                next: employees => this.employees.set(employees),
                error: error => {
                    this.employees.set([]);
                    this.errorMessage.set(
                        toApiError(error, LIST_ERROR_MESSAGES).message
                    );
                }
            });
    }

    /** Acción disponible para un miembro, o `null` si no se puede gestionar su acceso. */
    accessActionFor(member: TeamMember): AccessAction | null {
        const action: AccessAction = member.status === 'BLOCKED' ? 'UNBLOCK' : 'BLOCK';

        return this.changeAccess.reasonNotAllowed(member, action) === null ? action : null;
    }

    requestAccessChange(member: TeamMember, action: AccessAction): void {
        this.feedback.set(null);
        this.reasonDraft.set('');
        this.reasonError.set(null);
        this.pendingChange.set({ memberId: member.id, action });
    }

    cancelAccessChange(): void {
        this.pendingChange.set(null);
        this.reasonError.set(null);
    }

    updateReason(value: string): void {
        this.reasonDraft.set(value);

        if (this.reasonError()) {
            const pending = this.pendingChange();
            this.reasonError.set(pending ? reasonProblem(pending.action, normalizeReason(value)) : null);
        }
    }

    isPending(member: TeamMember): boolean {
        return this.pendingChange()?.memberId === member.id;
    }

    confirmAccessChange(member: TeamMember): void {
        const pending = this.pendingChange();

        if (!pending || pending.memberId !== member.id || this.processingId()) {
            return;
        }

        const problem = reasonProblem(pending.action, normalizeReason(this.reasonDraft()));

        if (problem) {
            this.reasonError.set(problem);
            return;
        }

        this.processingId.set(member.id);

        this.changeAccess
            .execute(member, pending.action, this.reasonDraft())
            .pipe(
                finalize(() => {
                    this.processingId.set(null);
                    this.pendingChange.set(null);
                }),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe({
                next: updated => {
                    this.employees.update(list =>
                        list.map(item => item.id === updated.id ? updated : item)
                    );
                    this.feedback.set({
                        kind: 'success',
                        text: updated.status === 'BLOCKED'
                            ? `${updated.name} quedó bloqueado: ya no puede iniciar sesión ni atender clientes.`
                            : `${updated.name} fue desbloqueado y puede volver a iniciar sesión.`
                    });
                },
                error: error => this.feedback.set({
                    kind: 'error',
                    text: error instanceof EmployeeAccessError
                        ? error.message
                        : toApiError(error, ACCESS_ERROR_MESSAGES).message
                })
            });
    }

    statusLabel(member: TeamMember): string {
        return STATUS_LABELS[member.status];
    }

    roleLabel(member: TeamMember): string {
        return member.role === 'ADMIN' ? 'Administrador' : 'Barbero';
    }

    documentLabel(member: TeamMember): string {
        return member.documentType === 'CE' ? 'C.E.' : 'C.C.';
    }

    specialtiesOf(member: TeamMember): string[] {
        return member.specialty
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);
    }

    formatCell(cell: string): string {
        const digits = cell.replace(/\D/g, '');

        return digits.length === 10
            ? `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
            : cell;
    }
}
