import {
    Component,
    inject
} from '@angular/core';

import {
    CommonModule
} from '@angular/common';

import {
    Router
} from '@angular/router';

import {
    LoginUseCase
} from '../../application/use-cases/login.use-case';

import {
    ErrorMessageOverrides,
    toApiError
} from '../../../../core/errors';

import {
    AuthLegalNoticeComponent
} from '../../../../shared/components/legal-consent/auth-legal-notice.component';


/** Mensajes del inicio de sesión (sobrescriben el catálogo general). */
const LOGIN_ERROR_MESSAGES: ErrorMessageOverrides = {
    // Respuestas del backend
    US_004: 'Tu cuenta de Google no está registrada en SmartBarber. Regístrate como cliente o registra tu barbería.',
    ACCOUNT_NOT_REGISTERED: 'Tu cuenta de Google no está registrada en SmartBarber. Regístrate como cliente o registra tu barbería.',
    CT_004: 'Tu cuenta existe, pero no tiene un perfil de cliente. Completa tu registro como cliente.',
    BP_004: 'La barbería asociada a tu cuenta ya no existe. Comunícate con soporte.',
    AT_001: 'Google entregó una sesión vencida. Vuelve a intentarlo.',
    AT_002: 'Tu cuenta no está activa. Comunícate con el administrador de tu barbería o con soporte.',
    TECH_001: 'No fue posible validar tu sesión de Google. Vuelve a intentarlo.',
    TECH_006: 'No fue posible validar tu sesión de Google. Vuelve a intentarlo.',
    TECH_008: 'Google entregó una sesión vencida. Vuelve a intentarlo.',
    HTTP_401: 'No fue posible validar tu sesión de Google. Vuelve a intentarlo.',

    // Validaciones locales del perfil
    USER_BLOCKED: 'Tu cuenta se encuentra bloqueada. Comunícate con soporte.',
    USER_INACTIVE: 'Tu cuenta no está activa. Comunícate con soporte.',
    INVALID_ROLE: 'No fue posible identificar el rol de tu cuenta. Comunícate con soporte.',
    FIREBASE_UID_MISMATCH: 'No fue posible validar tu identidad. Vuelve a intentarlo.',
    MISSING_AUTH_USERID: 'Tu perfil está incompleto en SmartBarber. Comunícate con soporte.',
    MISSING_AUTH_CUSTOMERID: 'Tu perfil de cliente está incompleto. Comunícate con soporte.',
    MISSING_AUTH_EMPLOYEEID: 'Tu perfil de barbero está incompleto. Comunícate con el administrador de tu barbería.',
    MISSING_AUTH_BARBERSHOPID: 'Tu cuenta no tiene una barbería asociada. Comunícate con el administrador de tu barbería.',

    DEFAULT: 'No fue posible iniciar sesión. Inténtalo nuevamente.'
};

/** Errores en los que conviene invitar al usuario a registrarse. */
const NOT_REGISTERED_CODES = new Set(['US_004', 'ACCOUNT_NOT_REGISTERED', 'CT_004']);

/** El usuario cerró la ventana de Google: no es un error que deba alarmarlo. */
const CANCELLED_CODES = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request']);

@Component({
    selector: 'app-login',

    standalone: true,

    imports: [
        CommonModule,
        AuthLegalNoticeComponent
    ],

    templateUrl:
        './login.component.html',

    styleUrl:
        './login.component.css'
})
export class LoginComponent {

    private readonly loginUseCase =
        inject(LoginUseCase);

    private readonly router =
        inject(Router);


    loading = false;

    errorMessage = '';

    /** true cuando la cuenta no existe en SmartBarber y conviene registrarse. */
    suggestRegister = false;


    async loginWithGoogle(): Promise<void> {
        if (this.loading) {
            return;
        }

        this.loading = true;
        this.errorMessage = '';
        this.suggestRegister = false;

        try {
            await this.loginUseCase.execute();

            await this.router.navigate(['/panel/home'], {
                replaceUrl: true
            });
        } catch (error: unknown) {
            const apiError = toApiError(error, LOGIN_ERROR_MESSAGES);

            if (apiError.code && CANCELLED_CODES.has(apiError.code)) {
                return;
            }

            this.errorMessage = apiError.message;
            this.suggestRegister =
                !!apiError.code && NOT_REGISTERED_CODES.has(apiError.code);
        } finally {
            this.loading = false;
        }
    }


    async goToRegister(): Promise<void> {

        await this.router.navigate([
            '/auth/register'
        ]);
    }


    async goToAdminRegister(): Promise<void> {

        await this.router.navigate([
            '/auth/register-admin'
        ]);
    }
}