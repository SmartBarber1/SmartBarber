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

  // 🟢 Petición GET para listar servicios
  getServicesByBarberiaId(barberiaId: string): Observable<BarberServicePayload[]> {
    return this.getHeadersObservable().pipe(
      switchMap(headers => 
        this.http.get<BarberServicePayload[]>(`${this.apiUrl}/barberia/${barberiaId}`, { headers })
      )
    );
  }

  // 🟢 Petición POST para crear servicio
  createService(payload: BarberServicePayload): Observable<any> {
    return this.getHeadersObservable().pipe(
      switchMap(headers => 
        this.http.post(`${this.apiUrl}/crear-servicio`, payload, { headers })
      )
    );
  }

  // 🟢 Petición PUT para actualizar servicio
  updateService(serviceId: number | string, payload: BarberServicePayload): Observable<any> {
    return this.getHeadersObservable().pipe(
      switchMap(headers => 
        this.http.put(`${this.apiUrl}/actualizar-service/${serviceId}`, payload, { headers })
      )
    );
  }
}