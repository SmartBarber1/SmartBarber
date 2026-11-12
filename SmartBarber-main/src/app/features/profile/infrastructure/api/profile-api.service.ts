import {
    Injectable,
    inject
} from '@angular/core';

import {
    HttpClient
} from '@angular/common/http';

import {
    Observable,
    forkJoin,
    of,
    map,
    switchMap
} from 'rxjs';

import {
    environment
} from '../../../../../environments/environment';

import {
    ClientProfile,
    UpdateProfileRequest
} from '../../domain/models/profile.model';

import {
    UserProfile
} from '../../domain/models/user-profile.model';

import {
    ProfileRepository
} from '../../domain/repositories/profile.repository';

import {
    SessionService
} from '../../../../core/auth/services/session.service';

import {
    FirebaseAuthService
} from '../../../../core/auth/services/firebase-auth.service';

// import {
//     ClientRegistrationResponse
// } from '../../domain/models/profile.model';

@Injectable()
export class ProfileApiService
    extends ProfileRepository {

    private readonly http =
        inject(HttpClient);

    private readonly sessionService =
        inject(SessionService);

    private readonly firebaseAuth =
        inject(FirebaseAuthService);

    private readonly apiUrl =
        environment.apiUrl;

    override getProfile():
        Observable<UserProfile> {

        const session =
            this.sessionService.currentSession;

        const firebaseUser =
            this.firebaseAuth.getCurrentUser();

        if (!session) {

            return of({
                userId: '',
                firebaseUid:
                    firebaseUser?.uid ?? '',
                email:
                    firebaseUser?.email ?? '',
                displayName:
                    firebaseUser?.displayName ?? '',
                role: 'CLIENT',
                status: 'ACTIVE',
                tenantId: null,
                photoUrl:
                    firebaseUser?.photoURL ?? null,
                clientId: null,
                barberId: null,
                barbershopId: null,
                barbershopName: null,
                document: null,
                documentType: null,
                name:
                    firebaseUser?.displayName ?? null,
                cell: null
            });
        }

        const clientRequest =
            session.clientId
                ? this.http.get<ClientProfile>(
                    `${this.apiUrl}/customer-service/id/${session.clientId}`
                )
                : of(null);

        const employeeRequest =
            session.barberId
                ? this.http.get<any>(
                    `${this.apiUrl}/employee-service/id/${session.barberId}`
                )
                : of(null);

        const barberShopRequest =
            session.barbershopId
                ? this.http.get<any>(
                    `${this.apiUrl}/barber-service/id/${session.barbershopId}`
                )
                : of(null);

        return forkJoin({

            client: clientRequest,

            employee: employeeRequest,

            barberShop: barberShopRequest

        }).pipe(

            map(data => {

                const client =
                    data.client;

                const employee =
                    data.employee;

                const barberShop =
                    data.barberShop;

                return {

                    userId:
                        session.userId,

                    firebaseUid:
                        session.firebaseUid,

                    email:
                        client?.email ??
                        employee?.email ??
                        session.email,

                    displayName:
                        client?.name ??
                        employee?.name ??
                        session.displayName,

                    role:
                        session.role,

                    status:
                        session.status,

                    tenantId:
                        session.tenantId,

                    photoUrl:
                        session.photoUrl,

                    clientId:
                        session.clientId,

                    barberId:
                        session.barberId,

                    barbershopId:
                        session.barbershopId,

                    barbershopName:
                        barberShop?.name ??
                        null,

                    document:
                        client?.document ??
                        employee?.document ??
                        null,

                    documentType:
                        client?.documentType ??
                        employee?.documentType ??
                        null,

                    name:
                        client?.name ??
                        employee?.name ??
                        null,

                    cell:
                        client?.cell ??
                        employee?.cell ??
                        null
                };
            })
        );
    }

    override updateProfile(
        clientId: string,

        request: UpdateProfileRequest
    ):
        Observable<ClientProfile> {

        return this.http.put<ClientProfile>(
            `${this.apiUrl}/customer-service/update-customer/${clientId}`,
            request
        );
    }
}