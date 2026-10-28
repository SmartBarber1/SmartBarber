import {
  Injectable,
  inject
} from '@angular/core';

import {
  SessionService
} from '../../../../core/auth/services/session.service';

import {
  PanelNavigationGroup,
  PanelNavigationItem
} from '../../domain/models/panel-navigation.model';

import {
  UserRole
} from '../../../../core/auth/model/auth-session.model';


@Injectable()
export class PanelNavigationService {

  private readonly sessionService =
    inject(SessionService);


  private readonly groups:
    PanelNavigationGroup[] = [


      // =====================================================
      // GENERAL
      // =====================================================

      {
        id: 'general',

        label: 'General',

        roles: [
          'CLIENT',
          'BARBER',
          'ADMIN'
        ],

        items: [

          {
            id: 'dashboard',

            label: 'Inicio',

            description:
              'Resumen de tu actividad en SmartBarber.',

            icon: 'home',

            route:
              '/panel/home',

            roles: [
              'CLIENT',
              'BARBER',
              'ADMIN'
            ],

            status:
              'AVAILABLE',

            visible:
              true
          },

          {
            id: 'subscription-acquire',

            label: 'Adquirir suscripción',

            description:
              'Selecciona un plan e inicia la transacción para tu barbería.',

            icon: 'wallet',

            route:
              '/panel/subscription/status',

            roles: [
              'ADMIN'
            ],

            status:
              'AVAILABLE',

            visible:
              true
          },


          {
            id: 'profile',

            label: 'Mi perfil',

            description:
              'Consulta y administra tu información personal.',

            icon: 'profile',

            route:
              '/panel/profile',

            roles: [
              'CLIENT',
              'BARBER',
              'ADMIN'
            ],

            status:
              'AVAILABLE',

            visible:
              true
          }

        ]
      },


      // =====================================================
      // CLIENTE
      // =====================================================

      {
        id: 'client',

        label: 'Mi experiencia',

        roles: [
          'CLIENT'
        ],

        items: [

          {
            id: 'reservations',

            label: 'Mis reservas',

            description:
              'Consulta y gestiona tus reservas.',

            icon: 'calendar',

            route:
              '/panel/reservas',

            roles: [
              'CLIENT'
            ],

            status:
              'AVAILABLE',

            visible:
              true
          },


          {
            id: 'virtual-queue',

            label: 'Cola virtual',

            description:
              'Consulta turnos disponibles y tiempos aproximados.',

            icon: 'queue',

            route:
              '/panel/virtual-queue',

            roles: [
              'CLIENT'
            ],

            status:
              'COMING_SOON',

            visible:
              true
          },


          {
            id: 'reservation-history',

            label: 'Historial',

            description:
              'Consulta tus reservas y servicios anteriores.',

            icon: 'history',

            route:
              '/panel/history',

            roles: [
              'CLIENT'
            ],

            status:
              'COMING_SOON',

            visible:
              true
          },


          {
            id: 'notifications',

            label: 'Notificaciones',

            description:
              'Consulta avisos relacionados con tus reservas.',

            icon: 'bell',

            route:
              '/panel/notifications',

            roles: [
              'CLIENT'
            ],

            status:
              'COMING_SOON',

            visible:
              true
          }

        ]
      },


      // =====================================================
      // BARBERO
      // =====================================================

      {
        id: 'barber',

        label: 'Operación',

        roles: [
          'BARBER'
        ],

        items: [

          {
            id: 'agenda',

            label: 'Mi agenda',

            description:
              'Consulta las reservas asignadas a tu agenda.',

            icon: 'calendar',

            route:
              '/panel/agenda',

            roles: [
              'BARBER'
            ],

            status:
              'COMING_SOON',

            visible:
              true
          },


          {
            id: 'barber-queue',

            label: 'Cola virtual',

            description:
              'Administra la atención de clientes en espera.',

            icon: 'queue',

            route:
              '/panel/virtual-queue',

            roles: [
              'BARBER'
            ],

            status:
              'AVAILABLE',

            visible:
              true
          },


          {
            id: 'barber-clients',

            label: 'Clientes',

            description:
              'Consulta clientes relacionados con tus servicios.',

            icon: 'users',

            route:
              '/panel/clients',

            roles: [
              'BARBER'
            ],

            status:
              'COMING_SOON',

            visible:
              true
          }

        ]
      },


      // =====================================================
      // ADMINISTRADOR
      // =====================================================

      {
        id: 'admin',

        label: 'Administración',

        roles: [
          'ADMIN'
        ],

        items: [

          {
            id: 'barbershop',

            label: 'Mi barbería',

            description:
              'Configura tu barbería, horarios y días festivos.',

            icon: 'home',

            route:
              '/panel/barbershop',

            roles: [
              'ADMIN'
            ],

            status:
              'AVAILABLE',

            visible:
              true
          },

          {
            id: 'barbers',

            label: 'Barberos y usuarios',

            description:
              'Administra el equipo y los usuarios.',

            icon: 'users',

            route:
              '/panel/users',

            roles: [
              'ADMIN'
            ],

            status:
              'AVAILABLE',

            visible:
              true
          },

          {
            id: 'services',

            label: 'Servicios',

            description:
              'Gestiona los servicios que ofrece tu barbería.',

            icon: 'scissors',

            route:
              '/panel/services',

            roles: [
              'ADMIN'
            ],

            status:
              'AVAILABLE',

            visible:
              true
          },

          {
            id: 'subscription',

            label: 'Suscripción y pagos',

            description:
              'Adquirir suscripción, consultar pagos y administrar tu plan.',

            icon: 'wallet',

            route:
              '/panel/subscription',

            roles: [
              'ADMIN'
            ],

            status:
              'AVAILABLE',

            visible:
              true
          },

          {
            id: 'schedules',

            label: 'Horarios',

            description:
              'Configura la jornada laboral de los barberos de tu barbería.',

            icon: 'clock',

            route:
              '/panel/horarios',

            roles: [
              'ADMIN'
            ],

            status:
              'AVAILABLE',

            visible:
              true
          },

          {
            id: 'statistics',

            label: 'Estadísticas',

            description:
              'Ingresos, ocupación, desempeño del equipo y comportamiento de los clientes.',

            icon: 'chart',

            route:
              '/panel/statistics',

            roles: [
              'ADMIN'
            ],

            status:
              'AVAILABLE',

            visible:
              true
          }
        ]
      }

    ];


  // =====================================================
  // NAVEGACIÓN SEGÚN ROL
  // =====================================================

  getNavigation():
    PanelNavigationGroup[] {

    return this.getNavigationForAccess(false);
  }


  getNavigationForAccess(
    subscriptionRestricted: boolean
  ): PanelNavigationGroup[] {

    const role =
      this.sessionService
        .currentSession
        ?.role;


    if (!role) {

      return [];
    }


    return this.groups

      .filter(
        group =>
          group.roles.includes(
            role
          )
      )

      .map(
        group => ({

          ...group,

          items:
            group.items.filter(
              item =>
                item.visible &&
                item.roles.includes(
                  role
                  ) &&
                  (
                    subscriptionRestricted
                        ? ['dashboard', 'profile', 'subscription'].includes(item.id)
                        : true
                  )
              ).map(item =>
                subscriptionRestricted && item.id === 'subscription'
                  ? {
                      ...item,
                      label: 'Adquirir suscripción',
                      description: 'Selecciona un plan e inicia la transacción para tu barbería.',
                      route: '/panel/subscription/status'
                    }
                  : item
              )

        })
      )

      .filter(
        group =>
          group.items.length > 0
      );
  }


  // =====================================================
  // DISPONIBLES
  // =====================================================

  getAvailableItems():
    PanelNavigationItem[] {

    return this.getNavigation()

      .flatMap(
        group =>
          group.items
      )

      .filter(
        item =>
          item.status ===
          'AVAILABLE'
      );
  }


  // =====================================================
  // PRÓXIMAMENTE
  // =====================================================

  getComingSoonItems():
    PanelNavigationItem[] {

    return this.getNavigation()

      .flatMap(
        group =>
          group.items
      )

      .filter(
        item =>
          item.status ===
          'COMING_SOON'
      );
  }


  // =====================================================
  // VALIDACIÓN DE ROL
  // =====================================================

  canAccessRole(
    roles: UserRole[]
  ):
    boolean {

    const role =
      this.sessionService
        .currentSession
        ?.role;


    return !!role &&
      roles.includes(
        role
      );
  }

}