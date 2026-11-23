import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import {
  DEFAULT_PENALTY_POLICY,
  PenaltyPolicy,
  PenaltyPolicySettings,
  PenaltyStanding
} from '../../domain/models/penalty.model';

/** Cliente HTTP de /penalty-service y de la corrección de inasistencias. */
@Injectable({ providedIn: 'root' })
export class PenaltyApiService {

  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/penalty-service`;

  /** Política por barbería: cambia poco, se reutiliza durante la sesión de la página. */
  private readonly policyCache = new Map<string, Observable<PenaltyPolicy>>();

  /**
   * Política de una barbería (la que ve el cliente antes de reservar). Si la
   * consulta falla se usan los valores por defecto para no bloquear la UI;
   * el servidor siempre aplica la política real.
   */
  policyOf(barbershopId: string): Observable<PenaltyPolicy> {
    const cached = this.policyCache.get(barbershopId);
    if (cached) {
      return cached;
    }
    const policy$ = this.http
      .get<PenaltyPolicy>(`${this.baseUrl}/policy/barbershop/${encodeURIComponent(barbershopId)}`)
      .pipe(
        catchError(() => {
          this.policyCache.delete(barbershopId);
          return of({ ...DEFAULT_PENALTY_POLICY, barbershopId });
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    this.policyCache.set(barbershopId, policy$);
    return policy$;
  }

  myPolicy(): Observable<PenaltyPolicy> {
    return this.http.get<PenaltyPolicy>(`${this.baseUrl}/policy/mine`);
  }

  updateMyPolicy(settings: PenaltyPolicySettings): Observable<PenaltyPolicy> {
    this.policyCache.clear();
    return this.http.put<PenaltyPolicy>(`${this.baseUrl}/policy/mine`, settings);
  }

  /** Barberías donde el cliente tiene inasistencias vigentes o restricción. */
  myStandings(): Observable<PenaltyStanding[]> {
    return this.http.get<PenaltyStanding[] | null>(`${this.baseUrl}/me`)
      .pipe(map(list => (Array.isArray(list) ? list : [])));
  }

  /** Estado del cliente en una barbería (antes de reservar). */
  myStanding(barbershopId: string): Observable<PenaltyStanding> {
    return this.http.get<PenaltyStanding>(`${this.baseUrl}/me/barbershop/${encodeURIComponent(barbershopId)}`);
  }

  /** Clientes en advertencia o restringidos de la barbería del administrador. */
  customers(): Observable<PenaltyStanding[]> {
    return this.http.get<PenaltyStanding[] | null>(`${this.baseUrl}/customers`)
      .pipe(map(list => (Array.isArray(list) ? list : [])));
  }

  liftRestriction(restrictionId: string, reason: string): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/restrictions/${encodeURIComponent(restrictionId)}/lift`, { reason });
  }

  /** El administrador corrige un "No asistió" marcado por error (48 h, con motivo). */
  revertNoShow(reservationId: string, reason: string): Observable<unknown> {
    return this.http.patch(
      `${environment.apiUrl}/reservation-service/${encodeURIComponent(reservationId)}/revert-no-show`,
      { reason }
    );
  }
}
