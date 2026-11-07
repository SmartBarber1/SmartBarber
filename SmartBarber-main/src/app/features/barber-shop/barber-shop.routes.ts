import {
    Routes
} from '@angular/router';

import {
    authGuard
} from '../../core/auth/guards/auth.guard';

import {
    roleGuard
} from '../../core/auth/guards/role.guard';


export const BARBER_SHOP_ROUTES: Routes = [

    // ============================================================
    // CONFIGURACIÓN PRINCIPAL
    // ============================================================

    {
        path: '',

        canActivate: [
            authGuard,
            roleGuard
        ],

        data: {
            roles: [
                'ADMIN'
            ]
        },

        loadComponent: () =>
            import(
                './components/branch-register/branch-register.component'
            ).then(
                m =>
                    m.BranchRegisterComponent
            )
    },


    // ============================================================
    // CONFIGURACIÓN
    // ============================================================

    {
        path: 'configuracion',

        canActivate: [
            authGuard,
            roleGuard
        ],

        data: {
            roles: [
                'ADMIN'
            ]
        },

        loadComponent: () =>
            import(
                './components/configuration/config.component'
            ).then(
                m =>
                    m.BarberConfigComponent
            )
    },


    // ============================================================
    // POLÍTICAS DE CANCELACIÓN
    // ============================================================

    {
        path: 'politicas-cancelacion',

        canActivate: [
            authGuard,
            roleGuard
        ],

        data: {
            roles: [
                'ADMIN'
            ]
        },

        loadComponent: () =>
            import(
                './components/cancellation-policies/cancellation-policies.component'
            ).then(
                m =>
                    m.CancellationPoliciesComponent
            )
    },


    // ============================================================
    // CANALES DE CONTACTO
    // ============================================================

    {
        path: 'canales-contacto',

        canActivate: [
            authGuard,
            roleGuard
        ],

        data: {
            roles: [
                'ADMIN'
            ]
        },

        loadComponent: () =>
            import(
                './components/contact-channels/contact-channels.component'
            ).then(
                m =>
                    m.ContactChannelsComponent
            )
    },


    // ============================================================
    // SERVICIOS
    // ============================================================

    {
        path: 'CRUD-Servicios',

        canActivate: [
            authGuard,
            roleGuard
        ],

        data: {
            roles: [
                'ADMIN'
            ]
        },

        loadComponent: () =>
            import(
                './components/crud-service/crud-servicios.component'
            ).then(
                m =>
                    m.BarberServiConfigComponent
            )
    }
];