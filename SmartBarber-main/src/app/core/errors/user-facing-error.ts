/**
 * Error de la aplicación cuyo mensaje ya está redactado para el usuario.
 * toApiError lo muestra tal cual en lugar del mensaje genérico.
 */
export class UserFacingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UserFacingError';
    }
}
