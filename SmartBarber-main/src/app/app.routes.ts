
import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './layouts/public-layout/public-layout.component';

export const routes: Routes = [
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./features/landing/landing.routes')
            .then(m => m.LANDING_ROUTES)
      },
      {
        path: 'barberShop',
        loadChildren: () =>
          import('./features/barber-shop/barber-shop.routes')
            .then(m => m.BARBER_SHOP_ROUTES)
      },
      {
        path: 'subscription',
        loadComponent: () =>
          import('./features/subscription/components/subscription/subscription.component')
            .then(m => m.SubscriptionComponent)
      },
      {
        path: 'reservar',
        loadChildren: () =>
          import('./features/reservations/reservations.routes')
            .then(m => m.RESERVATION_ROUTES)
      },
      {
        path: 'virtual-queue',
        loadChildren: () =>
          import('./features/virtual-queue/virtual-queue.routes')
            .then(m => m.VIRTUAL_QUEUE_ROUTES)
      },
      {
        path: 'auth',
        loadChildren: () =>
          import('./features/authentication/authentication.routes')
            .then(m => m.AUTHENTICATION_ROUTES)
      },
      {
        path: 'legal',
        loadChildren: () =>
          import('./features/legal/legal.routes')
            .then(m => m.LEGAL_ROUTES)
      }
    ]
  },
  {
    path: 'panel',
    loadChildren: () =>
      import('./features/panel/panel.routes')
        .then(m => m.PANEL_ROUTES)
  },
  {
    path: 'profile',
    loadChildren: () =>
      import('./features/profile/profile.routes')
        .then(m => m.PROFILE_ROUTES)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
