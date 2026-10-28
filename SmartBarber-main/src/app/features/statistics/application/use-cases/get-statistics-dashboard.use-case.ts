import { Injectable, inject } from '@angular/core';
import { Observable, defer } from 'rxjs';

import { SessionService } from '../../../../core/auth/services/session.service';

import { StatisticsAccessError } from '../../domain/errors/statistics.errors';
import { resolveStatisticsRange } from '../../domain/models/statistics-period';
import {
  StatisticsDashboard,
  StatisticsFilter
} from '../../domain/models/statistics.model';
import { StatisticsRepository } from '../../domain/repositories/statistics.repository';

@Injectable()
export class GetStatisticsDashboardUseCase {

  private readonly repository = inject(StatisticsRepository);

  private readonly sessionService = inject(SessionService);

  /**
   * Valida rol y filtro antes de consultar. `defer` hace que los errores de
   * validación lleguen por el canal de error del observable.
   */
  execute(filter: StatisticsFilter): Observable<StatisticsDashboard> {
    return defer(() => {
      const session = this.sessionService.currentSession;

      if (
        !session ||
        !this.sessionService.isActive() ||
        session.role !== 'ADMIN' ||
        !session.barbershopId
      ) {
        throw new StatisticsAccessError();
      }

      const range = resolveStatisticsRange(filter);

      return this.repository.getDashboard(session.barbershopId, range);
    });
  }
}
