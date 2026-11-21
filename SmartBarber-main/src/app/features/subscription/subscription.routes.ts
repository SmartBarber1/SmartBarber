import { Routes } from '@angular/router';
import { SubscriptionApiService } from './infrastructure/api/subscription-api.service';
import { PaymentApiService } from './infrastructure/api/payment-api.service';
import { PaymentRepository } from './domain/repositories/payment.repository';
import { GetPaymentHistoryUseCase } from './application/use-cases/get-payment-history.use-case';

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
    providers: [
      GetPaymentHistoryUseCase,
      { provide: PaymentRepository, useClass: PaymentApiService }
    ],
    loadComponent: () =>
      import('./pages/payment-history/payment-history.component')
        .then(m => m.PaymentHistoryComponent)
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