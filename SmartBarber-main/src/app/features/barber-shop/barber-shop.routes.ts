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
    // POLÍTICAS: ahora en /panel/politicas (features/penalty)
    // ============================================================

    {
        path: 'politicas-cancelacion',
        redirectTo: '/panel/politicas',
        pathMatch: 'full'
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