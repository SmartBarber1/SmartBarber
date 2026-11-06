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
    AuthSession
} from '../../../../core/auth/model/auth-session.model';

import {
    AuthLegalNoticeComponent
} from '../../../../shared/components/legal-consent/auth-legal-notice.component';


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


    async loginWithGoogle(): Promise<void> {
        if (this.loading) {
            return;
        }

        this.loading = true;
        this.errorMessage = '';

        try {
            await this.loginUseCase.execute();

            await this.router.navigate(['/panel/home'], {
                replaceUrl: true
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '';

            switch (message) {
                case 'USER_BLOCKED':
                    this.errorMessage =
                        'Tu cuenta se encuentra bloqueada. Comunícate con soporte.';
                    break;

                case 'USER_INACTIVE':
                    this.errorMessage =
                        'Tu cuenta no está activa. Comunícate con soporte.';
                    break;

                case 'INVALID_ROLE':
                    this.errorMessage =
                        'No fue posible identificar el rol de tu cuenta.';
                    break;

                case 'FIREBASE_UID_MISMATCH':
                    this.errorMessage =
                        'No fue posible validar tu identidad.';
                    break;

                case 'MISSING_AUTH_USERID':
                case 'MISSING_AUTH_CUSTOMERID':
                case 'MISSING_AUTH_EMPLOYEEID':
                case 'MISSING_AUTH_BARBERSHOPID':
                    this.errorMessage =
                        'El backend validó tu cuenta, pero no devolvió todos los datos del perfil asociado.';
                    break;

                default:
                    this.errorMessage =
                        'No fue posible iniciar sesión. Inténtalo nuevamente.';
            }
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