import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { Barbero } from '../models/reservation.model';
import { ResultadoHorario, ScheduleResultado } from '../models/schedule.model';
import { ReservationService } from './reservation.service';
import { extraerTurno, mapOcupados } from '../utils/schedule.utils';

/**
 * Orquesta "horario del barbero + reservas del día" y devuelve un resultado listo
 * para que el componente pinte los slots. No toca la UI.
 */
@Injectable({ providedIn: 'root' })
export class AvailabilityService {
  private readonly reservationService = inject(ReservationService);
  private readonly scheduleCache = new Map<string, any>();

  clearCache(): void {
    this.scheduleCache.clear();
  }

  getDisponibilidad(barbero: Barbero, fecha: string): Observable<ResultadoHorario> {
    return this.obtenerSchedule(barbero).pipe(
      switchMap(({ schedule, fallo, sinHorario }): Observable<ResultadoHorario> => {
        const turno = extraerTurno(schedule, fecha);

        // Sin horario, sin turno ese día o de vacaciones: no hace falta consultar reservas
        if (!turno || turno.vacaciones) {
          return of({ turno, ocupados: [], fallo, sinHorario, falloReservas: false });
        }

        return this.reservationService.getReservationsByEmployee(barbero.id, fecha).pipe(
          map((reservas: any): ResultadoHorario => ({
            turno, ocupados: mapOcupados(reservas), fallo: false, sinHorario: false, falloReservas: false
          })),
          catchError((err: any) => {
            // 404/409: el backend lo informa cuando el barbero todavía no tiene reservas
            const sinReservas = err?.status === 404 || err?.status === 409;
            if (!sinReservas) {
              console.error('No se pudieron cargar las reservas del barbero:', err?.status);
            }
            return of<ResultadoHorario>({
              turno, ocupados: [], fallo: false, sinHorario: false, falloReservas: !sinReservas
            });
          })
        );
      })
    );
  }

  /**
   * GET /schedule-service/empleado/{idEmpleado}.
   * Solo se guarda en caché un horario encontrado: "sin horario" (404/409 o
   * respuesta vacía) se vuelve a consultar, porque el administrador puede
   * configurarlo mientras el cliente está reservando.
   */
  private obtenerSchedule(b: Barbero): Observable<ScheduleResultado> {
    if (this.scheduleCache.has(b.id)) {
      return of<ScheduleResultado>({ schedule: this.scheduleCache.get(b.id), fallo: false, sinHorario: false });
    }

    return this.reservationService.getScheduleById(b.id).pipe(
      map((res: any): ScheduleResultado => {
        const raw = res?.data ?? res;
        const tieneDatos = !!raw && (!Array.isArray(raw) || raw.length > 0);
        if (!tieneDatos) {
          return { schedule: null, fallo: false, sinHorario: true };
        }
        this.scheduleCache.set(b.id, res);
        return { schedule: res, fallo: false, sinHorario: false };
      }),
      catchError((err: any) => {
        if (err?.status === 404 || err?.status === 409) {
          return of<ScheduleResultado>({ schedule: null, fallo: false, sinHorario: true });
        }
        console.error('No se pudo cargar el horario del barbero:', err?.status);
        return of<ScheduleResultado>({ schedule: null, fallo: true, sinHorario: false });
      })
    );
  }
}
