import { Routes } from '@angular/router';

export const LEGAL_ROUTES: Routes = [
  {
    path: 'privacidad',
    title: 'Política de tratamiento de datos | SmartBarber',
    loadComponent: () =>
      import('./pages/privacy-policy/privacy-policy.component')
        .then(m => m.PrivacyPolicyComponent)
  },
  {
    path: 'terminos',
    title: 'Términos y condiciones | SmartBarber',
    loadComponent: () =>
      import('./pages/terms/terms.component')
        .then(m => m.TermsComponent)
  },
  {
    path: 'cookies',
    title: 'Política de cookies | SmartBarber',
    loadComponent: () =>
      import('./pages/cookies-policy/cookies-policy.component')
        .then(m => m.CookiesPolicyComponent)
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'privacidad'
  }
];
