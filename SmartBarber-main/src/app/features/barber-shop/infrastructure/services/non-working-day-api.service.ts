import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay, tap } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { NonWorkingDay, NonWorkingDayRequest } from '../../domain/models/non-working-day.model';
import type { NonWorkingDayRepository } from '../../domain/repositories/non-working-day.repository';

/** Respuesta de /non-working-day-service (NonWorkingDayRsDto). */
interface NonWorkingDayResponse {
    id: string;
    barbershopId: string;
    date: string;
    reason: string;
    createdAt?: string;
}

/** Tiempo que se reutiliza la lista sin volver a consultar al servidor. */
const CACHE_TTL_MS = 60_000;

interface CacheEntry {
    expiresAt: number;
    days$: Observable<NonWorkingDay[]>;
}

@Injectable({ providedIn: 'root' })
export class NonWorkingDayApiService implements NonWorkingDayRepository {

    private readonly http = inject(HttpClient);
    private readonly baseUrl = `${environment.apiUrl}/non-working-day-service`;

    /**
     * Caché por barbería: la configuración y el agendamiento comparten una sola
     * petición; crear o eliminar un día la invalida.
     */
    private readonly cache = new Map<string, CacheEntry>();

    list(barbershopId: string): Observable<NonWorkingDay[]> {
        const cached = this.cache.get(barbershopId);

        if (cached && cached.expiresAt > Date.now()) {
            return cached.days$;
        }

        const days$ = this.http
            .get<NonWorkingDayResponse[] | null>(`${this.baseUrl}/barbershop/${encodeURIComponent(barbershopId)}`)
            .pipe(
                map(response => (Array.isArray(response) ? response : []).map(toDomain)),
                // Si falla, no se guarda el error en caché.
                tap({ error: () => this.cache.delete(barbershopId) }),
                shareReplay({ bufferSize: 1, refCount: false })
            );

        this.cache.set(barbershopId, { expiresAt: Date.now() + CACHE_TTL_MS, days$ });

        return days$;
    }

    create(barbershopId: string, request: NonWorkingDayRequest): Observable<NonWorkingDay> {
        return this.http
            .post<NonWorkingDayResponse>(this.baseUrl, request)
            .pipe(
                map(toDomain),
                tap(() => this.cache.delete(barbershopId))
            );
    }

    delete(barbershopId: string, id: string): Observable<void> {
        return this.http
            .delete<void>(`${this.baseUrl}/${encodeURIComponent(id)}`)
            .pipe(tap(() => this.cache.delete(barbershopId)));
    }
}

function toDomain(response: NonWorkingDayResponse): NonWorkingDay {
    return {
        id: response.id,
        date: response.date,
        reason: response.reason
    };
}
