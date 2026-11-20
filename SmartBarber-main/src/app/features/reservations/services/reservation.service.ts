import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError, timeout } from 'rxjs';
import { switchMap, catchError, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { HistoryScope, ReservationHistoryItem } from '../models/reservation.model';

/** Tiempo máximo de espera al crear una reserva (el servidor puede estar despertando). */
const CREATE_TIMEOUT_MS = 45_000;

export interface ReservationRatingPayload {
  rating: number;
  comment: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private apiUrl = environment.apiUrl || 'http://localhost:8080';

  constructor(private http: HttpClient) {}

  /**
   * Cabeceras de las peticiones. El token de Firebase lo agrega el interceptor
   * global (firebaseTokenInterceptor), igual que en el resto de la aplicación:
   * así se usa el token vigente sin forzar su renovación en cada petición (que
   * podía quedarse esperando) y nunca se lee un token guardado en el navegador.
   */
  private getAuthHeaders(): Observable<HttpHeaders> {
    return of(new HttpHeaders({ 'Content-Type': 'application/json' }));
  }

  confirmReservation(id: string): Observable<any> {
    return this.getAuthHeaders().pipe(
      switchMap(headers =>
        this.http.patch(`${this.apiUrl}/reservation-service/${id}/confirm`, {}, { headers })
      )
    );
  }

  cancelReservation(id: string): Observable<any> {
    return this.getAuthHeaders().pipe(
      switchMap(headers =>
        this.http.patch(`${this.apiUrl}/reservation-service/${id}/cancel`, {}, { headers })
      )
    );
  }

  /** PATCH /reservation-service/{id}/complete (BARBER, ADMIN): la reserva fue atendida. */
  completeReservation(id: string): Observable<any> {
    return this.getAuthHeaders().pipe(
      switchMap(headers =>
        this.http.patch(`${this.apiUrl}/reservation-service/${encodeURIComponent(id)}/complete`, {}, { headers })
      )
    );
  }

    /**
   * PATCH /reservation-service/{id}/reschedule (CUSTOMER, ADMIN): nueva hora de
   * una reserva agendada; conserva barbero y servicios y vuelve a "Pendiente".
   */
  rescheduleReservation(id: string, startTime: string): Observable<any> {
    return this.getAuthHeaders().pipe(
      switchMap(headers =>
        this.http.patch(`${this.apiUrl}/reservation-service/${encodeURIComponent(id)}/reschedule`, { startTime }, { headers })
      )
    );
  }

  /** PATCH /reservation-service/{id}/no-show (BARBER, ADMIN): el cliente no se presentó. */
  markNoShow(id: string): Observable<any> {
    return this.getAuthHeaders().pipe(
      switchMap(headers =>
        this.http.patch(`${this.apiUrl}/reservation-service/${encodeURIComponent(id)}/no-show`, {}, { headers })
      )
    );
  }

  /**
   * POST /reservation-review-service/crear-resena-reserva (CUSTOMER): reseña de
   * una reserva finalizada del propio cliente, una sola vez.
   */
  rateReservation(id: string, payload: ReservationRatingPayload): Observable<any> {
    return this.getAuthHeaders().pipe(
      switchMap(headers =>
        this.http.post(`${this.apiUrl}/reservation-review-service/crear-resena-reserva`, {
          reservationId: id,
          qualification: payload.rating,
          comment: payload.comment
        }, { headers })
      )
    );
  }

  /**
   * Barberos que el cliente puede reservar: cuenta activa y rol BARBER, sin
   * datos personales (GET /public/employee-service/barbershop/{id}/bookable).
   */
  getBookableBarbers(barberiaId: string): Observable<any> {
    return this.getAuthHeaders().pipe(
      switchMap(headers => this.http.get(
        `${this.apiUrl}/public/employee-service/barbershop/${encodeURIComponent(barberiaId)}/bookable`,
        { headers }
      ))
    );
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
        this.http.get<any>(`${this.apiUrl}/reservation-service/${segment}/${id}`, { headers })
      ),
      // El backend puede responder una lista directa o { data: [...] }
      map(res => (Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : [])) as ReservationHistoryItem[]),
      // Cuando no hay reservas el backend responde 409 con codigo RES_002: se trata como lista vacia
      catchError(err =>
        err?.error?.data?.code === 'RES_002' || err?.error?.code === 'RES_002'
          ? of([] as ReservationHistoryItem[])
          : throwError(() => err)
      )
    );
  }

  // Datos de un barbero (employee-service/id/{id})
  getEmployeeById(employeeId: string): Observable<any> {
    return this.getAuthHeaders().pipe(
      switchMap(headers => this.http.get(`${this.apiUrl}/employee-service/id/${employeeId}`, { headers }))
    );
  }

  createReservation(payload: any): Observable<any> {
    return this.getAuthHeaders().pipe(
      switchMap(headers => this.http.post(`${this.apiUrl}/reservation-service/create`, payload, { headers })),
      // Si el servidor no responde, la pantalla no se queda en "Procesando...".
      timeout({ first: CREATE_TIMEOUT_MS })
    );
  }
}