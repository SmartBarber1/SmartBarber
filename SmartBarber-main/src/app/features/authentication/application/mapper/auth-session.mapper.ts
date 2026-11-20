import { User } from 'firebase/auth';

import {
    AuthSession,
    SubscriptionBarberStatus,
    UserRole
} from '../../../../core/auth/model/auth-session.model';

import {
    BackendAuthenticationResponse,
    BackendRoleResponse
} from '../../domain/models/auth-session.model';

export function mapBackendAuthentication(
    response: BackendAuthenticationResponse,
    firebaseUser: User
): AuthSession {
    const role = mapRole(response.role);
    const userId = requireId(response.userId, 'userId');

    let clientId: string | null = null;
    let barberId: string | null = null;
    let barbershopId: string | null = null;
    let barbershopName: string | null = null;
    let subscriptionStatus: SubscriptionBarberStatus | null = null;

    if (role === 'CLIENT') {
        clientId = requireId(response.customerId, 'customerId');
    } else {
        barberId = requireId(response.employeeId, 'employeeId');
        barbershopId = requireId(response.barbershop?.id, 'barbershopId');
        barbershopName = response.barbershop?.name?.trim() || null;
        subscriptionStatus = mapSubscriptionStatus(
            response.barbershop?.subscription?.status
        );
    }

    return {
        userId,
        clientId,
        firebaseUid: firebaseUser.uid,
        email: firebaseUser.email ?? '',
        // Se usa el nombre del perfil en SmartBarber; el de la cuenta de Google
        // solo si el perfil no tiene nombre.
        displayName: response.displayName?.trim() || firebaseUser.displayName || '',
        role,
        status: 'ACTIVE',
        tenantId: barbershopId,
        photoUrl: firebaseUser.photoURL,
        barberId,
        barbershopId,
        barbershopName,
        subscriptionStatus
    };
}

function mapSubscriptionStatus(
    status: string | null | undefined
): SubscriptionBarberStatus | null {
    switch (status) {
        case 'ACTIVE':
        case 'APPROVED':
        case 'PENDING':
        case 'DECLINED':
        case 'NOT_SUBSCRIPTION':
        case 'EXPIRED':
        case 'REFUNDED':
            return status;
        default:
            return null;
    }
}

function mapRole(role: BackendRoleResponse): UserRole {
    switch (role) {
        case 'CUSTOMER':
        case 'Cliente':
            return 'CLIENT';
        case 'BARBER':
        case 'Barbero':
            return 'BARBER';
        case 'ADMIN':
        case 'Administrador':
            return 'ADMIN';
        default:
            throw new Error('INVALID_ROLE');
    }
}

function requireId(value: string | null | undefined, field: string): string {
    const id = value?.trim();

    if (!id) {
        throw new Error(`MISSING_AUTH_${field.toUpperCase()}`);
    }

    return id;
}
