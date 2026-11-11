import {
    Observable
} from 'rxjs';

import {
    CustomerOnboardingRequest,
    CustomerOnboardingResponse,
    CreateClientRequest,
    CreateClientResponse,
    CreateUserRequest,
    CreateUserResponse
} from '../models/client-registration.model';


export abstract class ClientRegistrationRepository {


    abstract createUser(
        request: CreateUserRequest
    ):
        Observable<CreateUserResponse>;


    abstract createClient(
        request: CreateClientRequest
    ):
        Observable<CreateClientResponse>;


    /*
     * =====================================================
     * ONBOARDING CLIENTE
     *
     * POST /customer-service/onboarding
     * =====================================================
     */

    abstract onboarding(
        request: CustomerOnboardingRequest
    ):
        Observable<CustomerOnboardingResponse>;

}