import {
    Injectable,
    inject
} from '@angular/core';

import {
    Observable,
    map,
    throwError
} from 'rxjs';

import {
    ClientRegistrationForm,
    ClientRegistrationResult
} from '../../domain/models/client-registration.model';

import {
    ClientRegistrationRepository
} from '../../domain/repositories/client-registration.repository';

import {
    FirebaseAuthService
} from '../../../../core/auth/services/firebase-auth.service';

import {
    SessionService
} from '../../../../core/auth/services/session.service';

import {
    USER_ROLE_IDS
} from '../../domain/models/user-role.model';


import {
    UserFacingError
} from '../../../../core/errors';

@Injectable()
export class RegisterClientUseCase {


    private readonly repository =
        inject(
            ClientRegistrationRepository
        );


    private readonly firebaseAuth =
        inject(
            FirebaseAuthService
        );


    private readonly sessionService =
        inject(
            SessionService
        );


    execute(
        form: ClientRegistrationForm
    ):
        Observable<ClientRegistrationResult> {


        const firebaseUser =
            this.firebaseAuth.getCurrentUser();


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
                        'La cuenta de Google no tiene correo electrónico.'
                    )
            );
        }


        /*
         * =====================================================
         * ONBOARDING
         * =====================================================
         */

        return this.repository
            .onboarding({

                user: {

                    roleId:
                        USER_ROLE_IDS.CLIENT

                },

                name:
                    form.name
                        .trim(),

                document:
                    form.document
                        .trim(),

                documentType:
                    form.documentType,

                cell:
                    form.cell
                        .trim(),

                email:
                    firebaseUser.email
                        .trim()
                        .toLowerCase()

            })
            .pipe(

                map(
                    response => {

                        const userId =
                            response.user.id;


                        const clientId =
                            response.id;


                        /*
                         * =================================================
                         * CREAR SESIÓN LOCAL
                         * =================================================
                         */

                        this.sessionService
                            .setSession({

                                userId,

                                clientId,

                                firebaseUid:
                                    firebaseUser.uid,

                                email:
                                    response.email,

                                displayName:
                                    response.name,

                                role:
                                    'CLIENT',

                                status:
                                    response.user.status ===
                                    'BLOCKED'
                                        ? 'BLOCKED'
                                        : 'ACTIVE',

                                tenantId:
                                    null,

                                photoUrl:
                                    firebaseUser.photoURL,

                                barberId:
                                    null,

                                barbershopId:
                                    null,

                                barbershopName:
                                    null,

                                subscriptionStatus:
                                    null

                            });


                        return {

                            userId,

                            clientId,

                            message:
                                'Cliente registrado correctamente.'

                        };

                    }
                )

            );

    }

}