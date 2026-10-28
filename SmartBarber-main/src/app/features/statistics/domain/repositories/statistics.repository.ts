import { Observable } from 'rxjs';

import {
  StatisticsDashboard,
  StatisticsDateRange
} from '../models/statistics.model';

export abstract class StatisticsRepository {

  /**
   * Indicadores de una sola barbería. El `barbershopId` siempre se toma de la
   * sesión autenticada (RN-38), nunca de la URL ni de un campo del formulario.
   */
  abstract getDashboard(
    barbershopId: string,
    range: StatisticsDateRange
  ): Observable<StatisticsDashboard>;
}
