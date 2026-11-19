import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../../environments/environment';

import {
  StatisticsDashboard,
  StatisticsDateRange
} from '../../domain/models/statistics.model';
import { StatisticsRepository } from '../../domain/repositories/statistics.repository';

import {
  StatisticsDashboardResponse,
  mapStatisticsDashboard
} from './statistics-api.mapper';

/**
 * Adaptador HTTP del tablero. El backend toma la barbería de la sesión
 * (RN-38), por eso `barbershopId` no viaja en la petición.
 */
@Injectable()
export class StatisticsApiRepository extends StatisticsRepository {

  private readonly http = inject(HttpClient);

  private readonly baseUrl = environment.apiUrl;

  override getDashboard(
    _barbershopId: string,
    range: StatisticsDateRange
  ): Observable<StatisticsDashboard> {
    const params = new HttpParams()
      .set('from', range.from)
      .set('to', range.to);

    return this.http
      .get<StatisticsDashboardResponse>(`${this.baseUrl}/statistics-service/dashboard`, { params })
      .pipe(
        map(mapStatisticsDashboard)
      );
  }
}
