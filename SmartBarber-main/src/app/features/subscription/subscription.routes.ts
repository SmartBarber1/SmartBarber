import { Routes } from '@angular/router';
import { SubscriptionApiService } from './infrastructure/api/subscription-api.service';

export const SUBSCRIPTION_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/subscription-dashboard/subscription-dashboard.component')
        .then(m => m.SubscriptionDashboardComponent)
  },
  {
    path: 'status',
    loadComponent: () =>
      import('./pages/subscription-status/subscription-status.component')
        .then(m => m.SubscriptionStatusComponent)
  },
  {
    path: 'renewal',
    providers: [SubscriptionApiService],
    loadComponent: () =>
      import('./pages/renewal-catalog/renewal-catalog.component')
        .then(m => m.RenewalCatalogComponent)
  },
  {
    path: 'payment-history',
    data: {
      title: 'Historial de pagos',
      description: 'Consulta los pagos relacionados con el plan de tu barbería.',
      availability: 'El historial detallado de pagos estará disponible próximamente.'
    },
    loadComponent: () =>
      import('./pages/subscription-module/subscription-module.component')
        .then(m => m.SubscriptionModuleComponent)
  },
  {
  path: 'subscription-history',
  data: {
    title: 'Historial de Suscripción',
    description: 'Consulta los registros y cambios de suscripción de tu barbería.'
  },
  loadComponent: () =>
    import('./pages/subscription-history/subscription-history.component')
      .then(m => m.SubscriptionHistoryComponent)
},
  {
    path: '**',
    redirectTo: ''
  }
];