import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { NonWorkingDay, NonWorkingDayRequest } from '../models/non-working-day.model';
import { NonWorkingDayApiService } from '../../infrastructure/services/non-working-day-api.service';

/**
 * Puerto de días no laborables. Quien lo usa no conoce URLs ni caché:
 * la implementación por defecto es la API del backend.
 */
@Injectable({
    providedIn: 'root',
    useExisting: NonWorkingDayApiService
})
export abstract class NonWorkingDayRepository {

    /** Días de la barbería desde hoy y durante un año, ordenados por fecha. */
    abstract list(barbershopId: string): Observable<NonWorkingDay[]>;

    /** Registra un día en la barbería del administrador con sesión. */
    abstract create(barbershopId: string, request: NonWorkingDayRequest): Observable<NonWorkingDay>;

    abstract delete(barbershopId: string, id: string): Observable<void>;
}
