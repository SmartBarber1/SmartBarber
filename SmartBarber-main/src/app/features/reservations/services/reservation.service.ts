import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { getAuth } from 'firebase/auth';
import { environment } from '../../../../environments/environment';
import { HistoryScope, ReservationHistoryItem } from '../models/reservation.model';

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private apiUrl = environment.apiUrl || 'http://localhost:8080';

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): Observable<HttpHeaders> {
    const auth = getAuth();
    const user = auth.currentUser;

    if (user) {
      return from(user.getIdToken(true)).pipe(
        switchMap(token => {
          const cleanToken = token.replace(/['"]+/g, '').trim();
          return new Observable<HttpHeaders>(subscriber => {
            subscriber.next(new HttpHeaders({
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${cleanToken}`
            }));
            subscriber.complete();
          });
        }),
        catchError(err => throwError(() => err))
      );
    }

    const token = (
      localStorage.getItem('token') ||
      localStorage.getItem('smartbarber.token') ||
      localStorage.getItem('firebaseToken') || ''
    ).replace(/['"]+/g, '').trim();

    return new Observable<HttpHeaders>(subscriber => {
      subscriber.next(new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }));
      subscriber.complete();
    });
  }

  getBarberias(): Observable<any> {
    return this.getAuthHeaders().pipe(
      switchMap(headers => this.http.get(`${this.apiUrl}/barber-service/find-all`, { headers }))
    );
  }

  getEmployeesByBarberiaId(barberiaId: string): Observable<any> {
    return this.getAuthHeaders().pipe(
      switchMap(headers => this.http.get(`${this.apiUrl}/public/employee-service/barbershop/${barberiaId}`, { headers }))
    );
  }

  getServicesByBarberiaId(barberiaId: string): Observable<any> {
    return this.getAuthHeaders().pipe(
      switchMap(headers => this.http.get(`${this.apiUrl}/services-service/barberia/${barberiaId}`, { headers }))
    );
  }

  // El id es el del HORARIO (numerico), por ejemplo /schedule-service/id/5
  getScheduleById(scheduleId: number | string): Observable<any> {
    return this.getAuthHeaders().pipe(
      switchMap(headers => this.http.get(`${this.apiUrl}/schedule-service/empleado/${scheduleId}`, { headers }))
    );
  }

  // Endpoint que debe crear el backend: reservas del empleado en un dia (YYYY-MM-DD)
  getReservationsByEmployee(employeeId: string, date: string): Observable<any> {
    return this.getAuthHeaders().pipe(
      switchMap(headers => this.http.get(
        `${this.apiUrl}/reservation-service/employee/${employeeId}`,
        { headers, params: { date } }
      ))
    );
  }

  // Historial de reservas segun alcance: customer | employee | barbershop
  // Nota: en reservation-service la barberia se consulta como /barber/{id}
  getReservationHistory(scope: HistoryScope, id: string): Observable<ReservationHistoryItem[]> {
    const segment = scope === 'barbershop' ? 'barber' : scope;
    return this.getAuthHeaders().pipe(
      switchMap(headers =>
        this.http.get<ReservationHistoryItem[]>(
          `${this.apiUrl}/reservation-service/${segment}/${id}`,
          { headers }
        )
      )
    );
  }

  createReservation(payload: any): Observable<any> {
    return this.getAuthHeaders().pipe(
      switchMap(headers => this.http.post(`${this.apiUrl}/reservation-service/create`, payload, { headers }))
    );
  }
}