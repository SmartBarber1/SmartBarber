import {
    Injectable
} from '@angular/core';

import {
    Observable,
    map,
    switchMap,
    throwError
} from 'rxjs';

import {
    FirebaseAuthService
} from '../../../../core/auth/services/firebase-auth.service';

import {
    SessionService
} from '../../../../core/auth/services/session.service';

import {
    AdminRegistrationForm,
    AdminRegistrationResult,
    BarberShopOnboardingResponse
} from '../../domain/models/admin-registration.model';

import {
    BarberShopRegisterRequest
} from '../../../barber-shop/domain/models/barber-shop.model';

import {
    AdminRegistrationRepository
} from '../../domain/repositories/admin-registration.repository';

import {
    USER_ROLE_IDS
} from '../../domain/models/user-role.model';

import {
    AuthRepository
} from '../../domain/repositories/auth.repository';

import {
    mapBackendAuthentication
} from '../mapper/auth-session.mapper';


import {
    UserFacingError
} from '../../../../core/errors';

@Injectable()
export class RegisterAdminUseCase {


    constructor(
        private readonly repository:
            AdminRegistrationRepository,

        private readonly firebaseAuthService:
            FirebaseAuthService,

        private readonly sessionService:
            SessionService,

        private readonly authRepository:
            AuthRepository
    ) { }


    execute(
        adminData: AdminRegistrationForm,
        barberShopData: BarberShopRegisterRequest
    ):
        Observable<AdminRegistrationResult> {


        const firebaseUser =
            this.firebaseAuthService
                .getCurrentUser();


        if (!firebaseUser) {

            return throwError(
                () =>
                    new UserFacingError(
                        'No existe una sesión autenticada con Google.'
                    )
            );
        }


        if (!firebaseUser.email) {

            return throwError(
                () =>
                    new UserFacingError(
                        'La cuenta de Google no tiene correo.'
                    )
            );
        }


        /*
         * =====================================================
         * ONBOARDING COMPLETO
         * =====================================================
         */

        const onboardingRequest = {

            name:
                barberShopData.name
                    .trim(),

            description:
                barberShopData.description
                    .trim(),

            location:
                barberShopData.location
                    .trim(),

            phone:
                barberShopData.phone
                    .trim(),

            document:
                barberShopData.document
                    .trim(),

            documentType:
                barberShopData.documentType,

            companyName:
                barberShopData.companyName
                    .trim(),

            employee: {

                user: {

                    roleId:
                        USER_ROLE_IDS.ADMIN

                },

                barberiaId:
                    crypto.randomUUID(),


                name:
                    adminData.name
                        .trim(),

                document:
                    adminData.document
                        .trim(),

                documentType:
                    adminData.documentType,

                cell:
                    adminData.cell
                        .trim(),

                email:
                    firebaseUser.email
                        .trim()
                        .toLowerCase(),

                specialty:
                    'Administrador'

            }

        };


        return this.repository
            .onboarding(
                onboardingRequest
            )
            .pipe(

                switchMap(
                    (
                        onboardingResponse:
                            BarberShopOnboardingResponse
                    ) => {

                        return this.authRepository
                            .verifyAuthentication()
                            .pipe(

                                map(
                                    backendAuthentication => {

                                        const session =
                                            mapBackendAuthentication(
                                                backendAuthentication,
                                                firebaseUser
                                            );

                                        if (
                                            session.role !== 'ADMIN' ||
                                            session.userId !== onboardingResponse.employee.user.id ||
                                            session.barberId !== onboardingResponse.employee.id ||
                                            session.barbershopId !== onboardingResponse.id
                                        ) {
                                            throw new UserFacingError(
                        'La sesión autenticada no coincide con el administrador o la barbería recién registrados.'
                                            );
                                        }

                                        if (
                                            !session.barberId ||
                                            !session.barbershopId
                                        ) {
                                            throw new UserFacingError(
                        'La sesión autenticada no contiene la barbería del administrador.'
                                            );
                                        }

                                        this.sessionService
                                            .setSession(session);

                                        return {

                                            userId: session.userId,

                                            employeeId: session.barberId,

                                            barberShopId: session.barbershopId,

                                            message:
                                                'Barbería, usuario y administrador registrados correctamente.'

                                        };

                                    }
                                )

                            );

                    }
                )

            );

    }

}