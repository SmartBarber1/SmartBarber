import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, switchMap } from 'rxjs';
import { BarberServicePayload } from '../components/crud-service/crud-servicios.component';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BarberServiceService {
  private apiUrl = `${environment.apiUrl}/services-service`;

  constructor(private http: HttpClient) {}

  /**
   * Cabeceras de las peticiones. El token de Firebase lo agrega el interceptor
   * global (firebaseTokenInterceptor), como en el resto de la aplicación.
   */
  private getHeadersObservable(): Observable<HttpHeaders> {
    return of(new HttpHeaders({ 'Content-Type': 'application/json' }));
  }

  /** Servicios de la barbería (el administrador ve también los inactivos). */
  getServicesByBarberiaId(barberiaId: string): Observable<BarberServicePayload[]> {
    return this.getHeadersObservable().pipe(
      switchMap(headers => 
        this.http.get<BarberServicePayload[]>(`${this.apiUrl}/barberia/${barberiaId}`, { headers })
      )
    );
  }

  /** Crea un servicio en la barbería del administrador. */
  createService(payload: BarberServicePayload): Observable<any> {
    return this.getHeadersObservable().pipe(
      switchMap(headers => 
        this.http.post(`${this.apiUrl}/crear-servicio`, payload, { headers })
      )
    );
  }

  /** Actualiza un servicio de la barbería del administrador. */
  updateService(serviceId: number | string, payload: BarberServicePayload): Observable<any> {
    return this.getHeadersObservable().pipe(
      switchMap(headers => 
        this.http.put(`${this.apiUrl}/actualizar-service/${serviceId}`, payload, { headers })
      )
    );
  }

  /** PATCH /services-service/{id}/status: activa o desactiva el servicio. */
  changeStatus(serviceId: number | string, active: boolean): Observable<any> {
    return this.getHeadersObservable().pipe(
      switchMap(headers =>
        this.http.patch(`${this.apiUrl}/${encodeURIComponent(String(serviceId))}/status`, { active }, { headers })
      )
    );
  }

  /** DELETE /services-service/{id}: si ya se usó en reservas responde SC_006. */
  deleteService(serviceId: number | string): Observable<void> {
    return this.getHeadersObservable().pipe(
      switchMap(headers =>
        this.http.delete<void>(`${this.apiUrl}/${encodeURIComponent(String(serviceId))}`, { headers })
      )
    );
  }
}
