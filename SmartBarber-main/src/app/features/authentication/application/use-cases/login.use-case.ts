import {
    Injectable,
    inject
} from '@angular/core';

import {
    firstValueFrom
} from 'rxjs';

import {
    FirebaseAuthService
} from '../../../../core/auth/services/firebase-auth.service';

import {
    SessionService
} from '../../../../core/auth/services/session.service';

import {
    AuthRepository
} from '../../domain/repositories/auth.repository';

import {
    mapBackendAuthentication
} from '../mapper/auth-session.mapper';

import {
    AuthSession
} from '../../../../core/auth/model/auth-session.model';


@Injectable()
export class LoginUseCase {


    private readonly firebaseAuth =
        inject(FirebaseAuthService);


    private readonly sessionService =
        inject(SessionService);


    private readonly authRepository =
        inject(AuthRepository);


    /**
     * 1. Inicia sesión con Google (Firebase).
     * 2. Valida el token en el backend y obtiene el perfil.
     * Si el paso 2 falla, se cierra la sesión de Google para no dejar al
     * usuario autenticado en Firebase pero sin perfil en SmartBarber.
     */
    async execute():
        Promise<AuthSession> {

        const firebaseUser =
            await this.firebaseAuth
                .signInWithGoogle();

        try {
            const backendAuthentication =
                await firstValueFrom(
                    this.authRepository
                        .verifyAuthentication()
                );

            if (!backendAuthentication) {
                throw new Error('ACCOUNT_NOT_REGISTERED');
            }

            const session = mapBackendAuthentication(
                backendAuthentication,
                firebaseUser
            );

            this.sessionService
                .setSession(
                    session
                );

            return session;
        } catch (error: unknown) {
            this.sessionService.clearSession();
            await this.firebaseAuth.logout().catch(() => undefined);

            throw error;
        }
    }
}
