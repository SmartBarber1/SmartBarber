import { Routes } from '@angular/router';

import { authGuard } from '../../core/auth/guards/auth.guard';
import { roleGuard } from '../../core/auth/guards/role.guard';

import { GetStatisticsDashboardUseCase } from './application/use-cases/get-statistics-dashboard.use-case';
import { StatisticsRepository } from './domain/repositories/statistics.repository';
import { StatisticsMockRepository } from './infrastructure/mock/statistics-mock.repository';

export const STATISTICS_ROUTES: Routes = [
  {
    path: '',

    canActivate: [
      authGuard,
      roleGuard
    ],

    data: {
      roles: ['ADMIN']
    },

    providers: [
      // Datos quemados: reemplazar por el adaptador HTTP cuando exista el endpoint.
      { provide: StatisticsRepository, useClass: StatisticsMockRepository },
      GetStatisticsDashboardUseCase
    ],

    loadComponent: () =>
      import('./pages/statistics-dashboard/statistics-dashboard.component')
        .then(m => m.StatisticsDashboardComponent)
  }
];
