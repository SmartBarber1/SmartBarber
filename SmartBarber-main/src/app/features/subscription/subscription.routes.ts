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
    loadComponent: () =>
      import('./pages/payment-history/payment-history.component')
        .then(m => m.PaymentHistoryComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];