/** Acción de bloqueo o desbloqueo que no se puede realizar (se valida antes de llamar al API). */
export class EmployeeAccessError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EmployeeAccessError';
    }
}
