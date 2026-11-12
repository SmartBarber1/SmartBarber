import {
    Injectable,
    inject
} from '@angular/core';

import {
    HttpClient,
    HttpHeaders
} from '@angular/common/http';

import {
    Observable,
    from,
    throwError
} from 'rxjs';

import {
    switchMap
} from 'rxjs/operators';

import {
    environment
} from '../../../../../environments/environment';

import {
    FirebaseAuthService
} from '../../../../core/auth/services/firebase-auth.service';

import {
    ClientRegistrationRepository
} from '../../domain/repositories/client-registration.repository';

import {
    CustomerOnboardingRequest,
    CustomerOnboardingResponse,
    CreateClientRequest,
    CreateClientResponse,
    CreateUserRequest,
    CreateUserResponse
} from '../../domain/models/client-registration.model';


@Injectable()
export class ClientRegistrationApiService
    extends ClientRegistrationRepository {


    private readonly http =
        inject(HttpClient);


    private readonly firebaseAuth =
        inject(FirebaseAuthService);


    private readonly userApiUrl =
        `${environment.apiUrl}/public/user-service`;


    private readonly clientApiUrl =
        `${environment.apiUrl}/public/customer-service`;


    private readonly onboardingApiUrl =
        `${environment.apiUrl}/public/customer-service/onboarding`;


    /*
     * =====================================================
     * MÉTODO ANTIGUO
     * =====================================================
     */

    override createUser(
        request: CreateUserRequest
    ):
        Observable<CreateUserResponse> {

        return this.http.post<CreateUserResponse>(
            `${this.userApiUrl}/crear-usuario`,
            request
        );
    }


    /*
     * =====================================================
     * MÉTODO ANTIGUO
     * =====================================================
     */

    override createClient(
        request: CreateClientRequest
    ):
        Observable<CreateClientResponse> {

        return this.http.post<CreateClientResponse>(
            `${this.clientApiUrl}/crear-cliente`,
            request
        );
    }


    /*
     * =====================================================
     * ONBOARDING CLIENTE
     *
     * IMPORTANTE:
     *
     * El backend del cliente actualmente lee el token
     * desde:
     *
     *     idToken
     *
     * y no desde Authorization.
     *
     * El interceptor seguirá enviando Authorization,
     * pero aquí agregamos también idToken.
     * =====================================================
     */

    override onboarding(
        request: CustomerOnboardingRequest
    ):
        Observable<CustomerOnboardingResponse> {

        return from(
            this.firebaseAuth.getIdToken()
        )
            .pipe(

                switchMap(
                    token => {

                        if (!token) {

                            return throwError(
                                () =>
                                    new Error(
                                        'No existe un token de Firebase válido.'
                                    )
                            );
                        }


                        const headers =
                            new HttpHeaders({
                                idToken:
                                    `Bearer ${token}`
                            });


                        return this.http.post<CustomerOnboardingResponse>(
                            this.onboardingApiUrl,
                            request,
                            {
                                headers
                            }
                        );

                    }
                )

            );
    }

}