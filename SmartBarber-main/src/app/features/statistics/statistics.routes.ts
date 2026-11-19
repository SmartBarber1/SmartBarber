import { Routes } from '@angular/router';

import { authGuard } from '../../core/auth/guards/auth.guard';
import { roleGuard } from '../../core/auth/guards/role.guard';

import { GetStatisticsDashboardUseCase } from './application/use-cases/get-statistics-dashboard.use-case';
import { StatisticsRepository } from './domain/repositories/statistics.repository';
import { StatisticsApiRepository } from './infrastructure/api/statistics-api.repository';

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
      // Datos reales del backend. Para una demostración sin backend se puede
      // registrar StatisticsMockRepository (infrastructure/mock) en su lugar.
      { provide: StatisticsRepository, useClass: StatisticsApiRepository },
      GetStatisticsDashboardUseCase
    ],

    loadComponent: () =>
      import('./pages/statistics-dashboard/statistics-dashboard.component')
        .then(m => m.StatisticsDashboardComponent)
  }
];
