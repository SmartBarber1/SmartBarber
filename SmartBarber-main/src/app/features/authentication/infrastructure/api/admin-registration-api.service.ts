import {
    Injectable,
    inject
} from '@angular/core';

import {
    HttpClient
} from '@angular/common/http';

import {
    Observable
} from 'rxjs';

import {
    environment
} from '../../../../../environments/environment';

import {
    AdminRegistrationRepository
} from '../../domain/repositories/admin-registration.repository';

import {
    CreateAdminRequest,
    CreateAdminResponse,
    CreateUserRequest,
    CreateUserResponse,
    BarberShopOnboardingRequest,
    BarberShopOnboardingResponse
} from '../../domain/models/admin-registration.model';

import {
    BarberShopRegisterRequest,
    BarberShopResponse
} from '../../../barber-shop/domain/models/barber-shop.model';


@Injectable()
export class AdminRegistrationApiService
    extends AdminRegistrationRepository {


    private readonly http =
        inject(HttpClient);


    private readonly baseUrl =
        environment.apiUrl;


    /*
     * =====================================================
     * MÉTODOS ANTIGUOS
     * =====================================================
     */

    override createBarberShop(
        request: BarberShopRegisterRequest
    ):
        Observable<BarberShopResponse> {

        return this.http.post<BarberShopResponse>(
            `${this.baseUrl}/public/barber-service/create-barber`,
            request
        );
    }


    override createUser(
        request: CreateUserRequest
    ):
        Observable<CreateUserResponse> {

        return this.http.post<CreateUserResponse>(
            `${this.baseUrl}/public/user-service/crear-usuario`,
            request
        );
    }


    override createAdmin(
        request: CreateAdminRequest
    ):
        Observable<CreateAdminResponse> {

        return this.http.post<CreateAdminResponse>(
            `${this.baseUrl}/public/employee-service/crear-empleado`,
            request
        );
    }


    /*
     * =====================================================
     * ONBOARDING BARBERÍA
     * =====================================================
     */

    override onboarding(
        request: BarberShopOnboardingRequest
    ):
        Observable<BarberShopOnboardingResponse> {

        return this.http.post<BarberShopOnboardingResponse>(
            `${this.baseUrl}/barber-service/onboarding`,
            request
        );
    }


    /*
     * =====================================================
     * BUSCAR BARBERÍA POR NOMBRE
     * =====================================================
     */

    override findBarberShopByName(
        name: string
    ):
        Observable<BarberShopResponse> {

        return this.http.get<BarberShopResponse>(
            `${this.baseUrl}/barber-service/name/${encodeURIComponent(name)}`
        );
    }

}