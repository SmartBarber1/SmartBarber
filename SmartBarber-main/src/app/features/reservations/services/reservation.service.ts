import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { getAuth } from 'firebase/auth';
import {CreateReservationPayload} from '../models/reservation.model'

import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private apiUrl = environment.apiUrl;

  // Endpoint de creación de reservas: POST {apiUrl}/reservation-service/create
  private readonly createReservationUrl = `${this.apiUrl}/reservation-service/create`;

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

  // Horario del empleado: GET /schedule-service/empleado/{idEmpleado}
  getScheduleById(employeeId: number | string): Observable<any> {
    return this.getAuthHeaders().pipe(
      switchMap(headers => this.http.get(`${this.apiUrl}/schedule-service/empleado/${employeeId}`, { headers }))
    );
  }

  // Reservas del empleado en un día (YYYY-MM-DD): GET /reservation-service/employee/{idEmpleado}?date=
  getReservationsByEmployee(employeeId: string, date: string): Observable<any> {
    return this.getAuthHeaders().pipe(
      switchMap(headers => this.http.get(
        `${this.apiUrl}/reservation-service/employee/${employeeId}`,
        { headers, params: { date } }
      ))
    );
  }

  createReservation(payload: CreateReservationPayload): Observable<any> {
    console.log("Http"+JSON.stringify(payload));
    return this.getAuthHeaders().pipe(
      switchMap(headers => this.http.post(this.createReservationUrl, payload, { headers }))
    );
  }
}