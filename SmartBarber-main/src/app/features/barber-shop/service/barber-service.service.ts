import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, switchMap } from 'rxjs';
import { BarberServicePayload } from '../components/crud-service/crud-servicios.component';
import { getAuth } from 'firebase/auth'; 

@Injectable({
  providedIn: 'root'
})
export class BarberServiceService {
  private apiUrl = 'http://localhost:8080/services-service';

  constructor(private http: HttpClient) {}

  // 🟢 Método para obtener headers con token fresco de Firebase
  private getHeadersObservable(): Observable<HttpHeaders> {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      // Si por algo no hay usuario en sesión, intentamos recurrir al storage como respaldo
      const rawToken = localStorage.getItem('token') || localStorage.getItem('smartbarber.token') || '';
      const token = rawToken.replace(/['"]+/g, '').trim();
      return new Observable(subscriber => {
        subscriber.next(new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }));
        subscriber.complete();
      });
    }

    // `getIdToken(true)` fuerza a Firebase a refrescar el token si ya expiró
    return from(currentUser.getIdToken(true)).pipe(
      switchMap(token => {
        const cleanToken = token.replace(/['"]+/g, '').trim();
        
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanToken}`
        });
        
        const obs = new Observable<HttpHeaders>(sub => {
          sub.next(headers);
          sub.complete();
        });
        return obs;
      })
    );
  }

  // 🟢 Petición GET para listar servicios
  getServicesByBarberiaId(barberiaId: string): Observable<BarberServicePayload[]> {
    console.log('🚀 [ENVIANDO PETICIÓN GET DESDE ANGULAR]');
    return this.getHeadersObservable().pipe(
      switchMap(headers => 
        this.http.get<BarberServicePayload[]>(`${this.apiUrl}/barberia/${barberiaId}`, { headers })
      )
    );
  }

  // 🟢 Petición POST para crear servicio
  createService(payload: BarberServicePayload): Observable<any> {
    console.log('🚀 [ENVIANDO PETICIÓN POST DESDE ANGULAR]');
    return this.getHeadersObservable().pipe(
      switchMap(headers => 
        this.http.post(`${this.apiUrl}/crear-servicio`, payload, { headers })
      )
    );
  }

  // 🟢 Petición PUT para actualizar servicio
  updateService(serviceId: number | string, payload: BarberServicePayload): Observable<any> {
    console.log('🚀 [ENVIANDO PETICIÓN PUT DESDE ANGULAR]');
    return this.getHeadersObservable().pipe(
      switchMap(headers => 
        this.http.put(`${this.apiUrl}/actualizar-service/${serviceId}`, payload, { headers })
      )
    );
  }
}