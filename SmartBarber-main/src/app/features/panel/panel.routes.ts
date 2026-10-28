import { Routes } from '@angular/router';

import {
  authGuard
} from '../../core/auth/guards/auth.guard';

import {
  roleGuard
} from '../../core/auth/guards/role.guard';

import {
  panelEntryGuard
} from './guards/panel-entry.guard';

import {
  barbershopSubscriptionGuard
} from './guards/barbershop-subscription.guard';

import {
  PanelNavigationService
} from './application/services/panel-navigation.service';


export const PANEL_ROUTES: Routes = [

  {
    path: '',

    canActivate: [
      authGuard,
      panelEntryGuard
    ],

    canActivateChild: [
      barbershopSubscriptionGuard
    ],

    providers: [
      PanelNavigationService
    ],

    loadComponent: () =>
      import('./pages/panel/panel.component')
        .then(
          m => m.PanelComponent
        ),

    children: [

      // ========================================================
      // INICIO
      // ========================================================

      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'home'
      },


      {
        path: 'home',
        children: []
      },


      // ========================================================
      // PERFIL
      // ========================================================

      {
        path: 'profile',

        canActivate: [
          authGuard
        ],

        loadChildren: () =>
          import(
            '../profile/profile.routes'
          ).then(
            m => m.PROFILE_ROUTES
          )
      },


      // ========================================================
      // MI BARBERÍA
      // ========================================================

      {
        path: 'barbershop',

        canActivate: [
          authGuard,
          roleGuard
        ],

        data: {
          roles: ['ADMIN']
        },

        loadComponent: () =>
          import(
            '../barber-shop/components/configuration/config.component'
          ).then(
            m => m.BarberConfigComponent
          )
      },


      // ========================================================
      // HORARIOS
      // ========================================================

      {
        path: 'horarios',

        canActivate: [
          authGuard,
          roleGuard
        ],

        data: {
          roles: ['ADMIN']
        },

        loadComponent: () =>
          import(
            '../barber-shop/components/configuration/horarios-atencion/horarios-atencion.component'
          ).then(
            m => m.HorariosAtencionComponent
          )
      },


      // ========================================================
      // USUARIOS / BARBEROS
      // ========================================================

      {
        path: 'users',

        canActivate: [
          authGuard,
          roleGuard
        ],

        data: {
          roles: ['ADMIN']
        },

        loadChildren: () =>
          import(
            '../user-management/user-management.routes'
          ).then(
            m => m.USER_MANAGEMENT_ROUTES
          )
      },


      // ========================================================
      // SERVICIOS
      // ========================================================

      {
        path: 'services',

        canActivate: [
          authGuard,
          roleGuard
        ],

        data: {
          roles: ['ADMIN']
        },

        loadComponent: () =>
          import(
            '../barber-shop/components/crud-service/Create-service/crud-servicios.component'
          ).then(
            m => m.BarberServiConfigComponent
          )
      },


      // ========================================================
      // SUSCRIPCIÓN
      // ========================================================

      {
        path: 'subscription',

        canActivate: [
          authGuard,
          roleGuard
        ],

        data: {
          roles: ['ADMIN']
        },

        loadChildren: () =>
          import(
            '../subscription/subscription.routes'
          ).then(
            m => m.SUBSCRIPTION_ROUTES
          )
      },


      // ========================================================
      // ESTADÍSTICAS
      // ========================================================

      {
        path: 'statistics',

        canActivate: [
          authGuard,
          roleGuard
        ],

        data: {
          roles: ['ADMIN']
        },

        loadChildren: () =>
          import(
            '../statistics/statistics.routes'
          ).then(
            m => m.STATISTICS_ROUTES
          )
      },


      // ========================================================
      // RESERVAS
      // ========================================================

      {
        path: 'reservas',

        canActivate: [
          authGuard,
          roleGuard
        ],

        data: {
          roles: ['CLIENT']
        },

        loadChildren: () =>
          import(
            '../reservations/reservations.routes'
          ).then(
            m => m.RESERVATION_ROUTES
          )
      },
      /*
       * COLA VIRTUAL
       */
      {
        path: 'virtual-queue',
        canActivate: [
          authGuard,
          roleGuard
        ],

        data: {
          roles: ['BARBER']
        },

        loadChildren: () =>
          import(
            '../virtual-queue/virtual-queue.routes'
          ).then(
            m => m.VIRTUAL_QUEUE_ROUTES
          )
      }
    ]
  }
];