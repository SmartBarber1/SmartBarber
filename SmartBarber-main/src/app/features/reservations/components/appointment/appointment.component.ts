import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import { SessionService } from '../../../../core/auth/services/session.service';
import { ReservationService } from '../../services/reservation.service';
import { AvailabilityService } from '../../services/availability.service';
import { CurrentUserService } from '../../services/current-user.service';

import { Barberia, Barbero, RangoOcupado, Servicio, SlotHorario } from '../../models/reservation.model';
import { Turno } from '../../models/schedule.model';

import { extraerLista, idBarberia, idServicio, toBarbero } from '../../mappers/reservation.mapper';
import { buildReservationPayload } from '../../mappers/reservation-payload.builder';
import { aFechaIso } from '../../utils/calendar.utils';
import { NonWorkingDayRepository } from '../../../barber-shop/domain/repositories/non-working-day.repository';
import { calcularEstadoBarbero, construirSlots } from '../../utils/schedule.utils';
import { mensajeErrorReserva } from '../../utils/http-error.utils';

import { BarberiaSelectorComponent } from './barberia-selector/barberia-selector.component';
import { BarberoListComponent } from './barbero-list/barbero-list.component';
import { ServicioListComponent } from './servicio-list/servicio-list.component';
import { CalendarioComponent } from './calendario/calendario.component';
import { HorariosSlotsComponent } from './horarios-slots/horarios-slots.component';
import { ResumenReservaComponent } from './resumen-reserva/resumen-reserva.component';

/**
 * Componente contenedor (smart): guarda el estado de la pantalla y orquesta a los hijos.
 * La lógica de horarios vive en utils/ + AvailabilityService; los hijos solo pintan.
 */
@Component({
  selector: 'app-appointment',
  standalone: true,
  imports: [
    CommonModule,
    BarberiaSelectorComponent,
    BarberoListComponent,
    ServicioListComponent,
    CalendarioComponent,
    HorariosSlotsComponent,
    ResumenReservaComponent
  ],
  templateUrl: './appointment.component.html',
  styleUrls: ['./appointment.component.css']
})
export class AppointmentComponent implements OnInit {
  private readonly reservationService = inject(ReservationService);
  private readonly availability = inject(AvailabilityService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly sessionService = inject(SessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly nonWorkingDays = inject(NonWorkingDayRepository);

  /** Días no laborables de la barbería elegida: fecha (AAAA-MM-DD) → motivo. */
  private diasNoLaborables = new Map<string, string>();

  /** Días del mes visible en que la barbería no atiende (para el calendario). */
  diasCerradosMes: ReadonlySet<number> = new Set<number>();

  // Sede y barberos
  barberias: Barberia[] = [];
  barberosFiltrados: Barbero[] = [];
  selectedBarberiaId: string = '';
  selectedBarbero: Barbero | null = null;

  // Calendario
  currentDate: Date = new Date();
  selectedDia: number | null = null;
  selectedFecha: string = '';
  selectedHora: string = '';

  // Servicios
  serviciosDisponibles: Servicio[] = [];
  selectedServicesIds: number[] = [];
  loadingServicios: boolean = false;

  // Resumen (derivado de los servicios elegidos)
  serviciosSeleccionados: Servicio[] = [];
  precioTotal: number = 0;
  duracionTotal: number = 30;

  // Horarios
  slotsHorarios: SlotHorario[] = [];
  loadingHorarios: boolean = false;
  errorHorario: string = '';
  avisoOcupacion: string = '';

  // Reserva
  isLoading: boolean = false;

  // Estado interno del día/barbero consultado (permite recalcular slots sin volver al backend)
  private turnoActual: Turno | null = null;
  private ocupadosActuales: RangoOcupado[] = [];

  ngOnInit(): void {
    this.actualizarMes();
    this.cargarBarberias();
  }

  // ───────────────────────── Carga de datos ─────────────────────────

  private cargarBarberias(): void {
    this.reservationService.getBarberias().subscribe({
      next: (res: any) => {
        this.barberias = extraerLista<Barberia>(res);

        const barberiaIdParam = this.route.snapshot.queryParamMap.get('barberiaId');

        if (barberiaIdParam && this.barberias.some(b => idBarberia(b) === barberiaIdParam)) {
          this.selectedBarberiaId = barberiaIdParam;
        } else if (this.barberias.length > 0) {
          this.selectedBarberiaId = idBarberia(this.barberias[0]);
        }

        if (this.selectedBarberiaId) {
          this.cargarDiasNoLaborables(this.selectedBarberiaId);
          this.cargarEmpleados(this.selectedBarberiaId);
          this.cargarServicios(this.selectedBarberiaId);
        }
      },
      error: (err: any) => console.error('Error al cargar las barberías:', err)
    });
  }

  private cargarEmpleados(barberiaId: string): void {
    if (!barberiaId) return;

    this.reservationService.getEmployeesByBarberiaId(barberiaId).subscribe({
      next: (res: any) => {
        this.barberosFiltrados = extraerLista(res).map(toBarbero);

        if (this.barberosFiltrados.length > 0) {
          this.selectedBarbero = this.barberosFiltrados[0];
          if (this.selectedFecha) {
            this.generarHorariosDisponibles();
          }
        } else {
          this.selectedBarbero = null;
          this.slotsHorarios = [];
        }
      },
      error: (err: any) => {
        console.error('Error al cargar empleados para la barbería:', err);
        this.barberosFiltrados = [];
        this.selectedBarbero = null;
        this.slotsHorarios = [];
      }
    });
  }

  /**
   * Días en que la barbería no atiende. Si la consulta falla no se bloquea la
   * reserva: el backend igual rechaza la fecha (ND_006).
   */
  private cargarDiasNoLaborables(barberiaId: string): void {
    this.diasNoLaborables = new Map();
    this.actualizarDiasCerradosMes();

    this.nonWorkingDays.list(barberiaId).subscribe({
      next: dias => {
        if (this.selectedBarberiaId !== barberiaId) return;
        this.diasNoLaborables = new Map(dias.map(d => [d.date, d.reason]));
        this.actualizarDiasCerradosMes();
        if (this.selectedFecha && this.diasNoLaborables.has(this.selectedFecha) && this.selectedBarbero) {
          this.generarHorariosDisponibles();
        }
      },
      error: () => {
        this.diasNoLaborables = new Map();
        this.actualizarDiasCerradosMes();
      }
    });
  }

  private actualizarDiasCerradosMes(): void {
    const prefijo = aFechaIso(this.currentDate, 1).slice(0, 8); // AAAA-MM-
    const dias = new Set<number>();

    for (const fecha of this.diasNoLaborables.keys()) {
      if (fecha.startsWith(prefijo)) {
        dias.add(Number(fecha.slice(8, 10)));
      }
    }

    this.diasCerradosMes = dias;
  }

  private cargarServicios(barberiaId: string): void {
    if (!barberiaId) return;

    this.loadingServicios = true;
    this.reservationService.getServicesByBarberiaId(barberiaId).subscribe({
      next: (res: any) => {
        this.serviciosDisponibles = extraerLista<Servicio>(res);
        this.selectedServicesIds = this.serviciosDisponibles
          .map(s => idServicio(s))
          .filter((id): id is number => id !== undefined && id !== null);
        this.recalcularResumen();
        this.recalcularSlots();
        this.loadingServicios = false;
      },
      error: (err: any) => {
        console.error('Error al cargar servicios para la barbería:', err);
        this.serviciosDisponibles = [];
        this.selectedServicesIds = [];
        this.recalcularResumen();
        this.loadingServicios = false;
      }
    });
  }

  // ───────────────────────── Eventos de los hijos ─────────────────────────

  onBarberiaChange(barberiaId: string): void {
    this.selectedBarberiaId = barberiaId;
    this.selectedHora = '';
    this.availability.clearCache();
    if (barberiaId) {
      this.cargarDiasNoLaborables(barberiaId);
      this.cargarEmpleados(barberiaId);
      this.cargarServicios(barberiaId);
    }
  }

  onBarberoSelect(barbero: Barbero): void {
    this.selectedBarbero = barbero;
    this.selectedHora = '';
    if (this.selectedDia) {
      this.generarHorariosDisponibles();
    }
  }

  toggleServicio(servicio: Servicio): void {
    const yaElegido = this.selectedServicesIds.includes(servicio.id);

    if (yaElegido) {
      if (this.selectedServicesIds.length <= 1) {
        alert('Debes mantener al menos un servicio seleccionado.');
        return;
      }
      this.selectedServicesIds = this.selectedServicesIds.filter(id => id !== servicio.id);
    } else {
      this.selectedServicesIds = [...this.selectedServicesIds, servicio.id];
    }

    this.recalcularResumen();
    this.recalcularSlots(); // la duración cambió: algunos huecos dejan de caber
  }

  cambiarMes(delta: number): void {
    // Se fija el día 1 para evitar saltos de mes cuando hoy es 29/30/31
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + delta, 1);
    this.actualizarDiasCerradosMes();
    this.actualizarMes();
  }

  seleccionarDia(dia: number): void {
    this.selectedDia = dia;
    this.selectedHora = '';
    this.selectedFecha = aFechaIso(this.currentDate, dia);

    if (this.selectedBarbero) {
      this.generarHorariosDisponibles();
    }
  }

  seleccionarHora(slot: SlotHorario): void {
    if (slot.disponible) {
      this.selectedHora = slot.hora;
    }
  }

  // ───────────────────────── Estado derivado ─────────────────────────

  private actualizarMes(): void {
    const hoy = new Date();
    if (hoy.getFullYear() === this.currentDate.getFullYear() && hoy.getMonth() === this.currentDate.getMonth()) {
      this.seleccionarDia(hoy.getDate());
    } else {
      this.selectedDia = null;
      this.selectedFecha = '';
      this.selectedHora = '';
      this.slotsHorarios = [];
    }
  }

  private recalcularResumen(): void {
    this.serviciosSeleccionados = this.serviciosDisponibles.filter(s => this.selectedServicesIds.includes(s.id));

    this.precioTotal = this.serviciosSeleccionados
      .reduce((acc, s) => acc + (s.special_price || s.price || 0), 0);

    const duracion = this.serviciosSeleccionados
      .reduce((acc, s) => acc + (Number(s.duration) || 0), 0);
    this.duracionTotal = duracion > 0 ? duracion : 30; // mínimo 30 si no hay dato
  }

  // ───────────────────────── Horarios y ocupación ─────────────────────────

  /** Consulta turno + reservas del día y marca como ocupados los slots que chocan. */
  private generarHorariosDisponibles(): void {
    const barbero = this.selectedBarbero;
    const fecha = this.selectedFecha;
    if (!barbero || !fecha) return;

    const motivoCierre = this.diasNoLaborables.get(fecha);
    if (motivoCierre) {
      this.loadingHorarios = false;
      this.avisoOcupacion = '';
      this.limpiarTurno();
      this.errorHorario = `La barbería no atiende este día (${motivoCierre}). Elige otra fecha.`;
      return;
    }

    this.loadingHorarios = true;
    this.errorHorario = '';
    this.avisoOcupacion = '';

    this.availability.getDisponibilidad(barbero, fecha).subscribe(r => {
      // Ignora respuestas viejas si el usuario ya cambió de barbero o de día
      if (this.selectedBarbero?.id !== barbero.id || this.selectedFecha !== fecha) return;

      this.loadingHorarios = false;

      if (!r.turno) {
        this.limpiarTurno();
        if (r.fallo) {
          this.errorHorario = 'No se pudo cargar el horario del barbero. Intenta de nuevo.';
        } else {
          this.errorHorario = r.sinHorario
            ? 'Este barbero no tiene un horario configurado.'
            : 'El barbero no tiene turno para este día.';
          this.setEstadoBarbero(barbero, 'descanso', 'Sin turno');
        }
        return;
      }

      if (r.turno.vacaciones) {
        this.limpiarTurno();
        this.errorHorario = 'El barbero está de vacaciones.';
        this.setEstadoBarbero(barbero, 'descanso', 'Vacaciones');
        return;
      }

      if (r.falloReservas) {
        this.avisoOcupacion = 'No se pudo consultar las reservas existentes; la disponibilidad puede no ser exacta.';
      }

      this.turnoActual = r.turno;
      this.ocupadosActuales = r.ocupados;

      this.recalcularSlots();
      const estado = calcularEstadoBarbero(r.ocupados, r.turno, fecha);
      this.setEstadoBarbero(barbero, estado.estado, estado.texto);
    });
  }

  /** Reconstruye los slots con el turno, las reservas y la duración de los servicios actuales. */
  private recalcularSlots(): void {
    if (!this.turnoActual) {
      this.slotsHorarios = [];
      return;
    }
    this.slotsHorarios = construirSlots(
      this.turnoActual,
      this.ocupadosActuales,
      this.duracionTotal,
      this.selectedFecha
    );
    // Si la hora elegida ya no está disponible, se limpia
    if (this.selectedHora && !this.slotsHorarios.some(s => s.hora === this.selectedHora && s.disponible)) {
      this.selectedHora = '';
    }
  }

  private limpiarTurno(): void {
    this.turnoActual = null;
    this.ocupadosActuales = [];
    this.slotsHorarios = [];
  }

  private setEstadoBarbero(b: Barbero, estado: string, texto: string): void {
    b.estado = estado;
    b.estadoTexto = texto;
  }

  // ───────────────────────── Crear reserva ─────────────────────────

  crearReserva(): void {
    if (this.isLoading) return;

    if (!this.currentUser.uid) {
      alert('⚠️ El perfil de usuario aún se está sincronizando. Por favor espera un segundo.');
      return;
    }

    if (!this.selectedBarbero || !this.selectedHora || !this.selectedFecha) {
      alert('Por favor selecciona un barbero, una fecha y un horario válido.');
      return;
    }

    if (this.selectedServicesIds.length === 0) {
      alert('⚠️ Debes seleccionar al menos un servicio para la reserva.');
      return;
    }

    const resultado = buildReservationPayload({
      customerId: this.sessionService.getClientId() || '',
      employeeId: this.selectedBarbero.id,
      barbershopId: this.selectedBarberiaId,
      serviceIds: this.selectedServicesIds,
      fecha: this.selectedFecha,
      hora: this.selectedHora
    });

    if (!resultado.ok) {
      alert(resultado.mensaje);
      return;
    }

    const payload = resultado.payload;
    console.log('📦 Payload enviado a /reservation-service/create:', JSON.stringify(payload, null, 2));

    this.isLoading = true;
    this.reservationService.createReservation(payload).subscribe({
      next: () => {
        this.isLoading = false;
        alert('¡Reserva creada exitosamente!');
        this.selectedHora = '';
        this.generarHorariosDisponibles(); // vuelve a leer la BD y marca el slot como ocupado
      },
      error: (err: any) => {
        this.isLoading = false;
        console.error('❌ Error al crear reserva:', err.status, err.error, '\nPayload enviado:', payload);
        alert(mensajeErrorReserva(err));
      }
    });
  }
}
