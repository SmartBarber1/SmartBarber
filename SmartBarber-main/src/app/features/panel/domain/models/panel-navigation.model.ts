import {
    UserRole,
    UserStatus
} from '../../../../core/auth/model/auth-session.model';

export type PanelNavigationItemStatus =
    | 'AVAILABLE'
    | 'COMING_SOON';

export interface PanelNavigationItem {
    id: string;
    label: string;
    description: string;
    icon: string;
    route: string;
    roles: UserRole[];
        status: PanelNavigationItemStatus;
    visible: boolean;
    /**
     * Módulo bloqueado porque la barbería no tiene una suscripción activa:
     * se muestra en el menú con candado, pero no se puede abrir.
     */
    locked?: boolean;
}

export interface PanelNavigationGroup {
    id: string;
    label: string;
    items: PanelNavigationItem[];
    roles: UserRole[];
}

export interface PanelSummary {
    title: string;
    subtitle: string;
    roleLabel: string;
    statusLabel: string;
    userName: string;
    email: string;
    barbershopName: string | null;
    tenantId: string | null;
    userId: string;
    clientId: string | null;
    barberId: string | null;
    barbershopId: string | null;
}