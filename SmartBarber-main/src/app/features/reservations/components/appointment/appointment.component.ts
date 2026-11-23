import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import { SessionService } from '../../../../core/auth/services/session.service';
import { ReservationService } from '../../services/reservation.service';
import { AvailabilityService } from '../../services/availability.service';
import { CurrentUserService } from '../../services/current-user.service';

import { Barberia, Barbero, RangoOcupado, ReservationHistoryItem, Servicio, SlotHorario } from '../../models/reservation.model';
import { Turno } from '../../models/schedule.model';

import { extraerLista, idBarberia, toBarbero } from '../../mappers/reservation.mapper';
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
import { CitaCliente, MisCitasComponent } from './mis-citas/mis-citas.component';
import { toApiError, toUserMessage } from '../../../../core/errors';

/** Anticipación mínima para cancelar o reprogramar (la misma regla del servidor, RES_018). */
const AVISO_MINUTOS = 60;

/** Estados de una cita que todavía no ocurre y sigue activa. */
const ESTADOS_ACTIVOS = new Set(['PENDING', 'CONFIRMED']);

const ETIQUETAS_ESTADO: Readonly<Record<string, string>> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada'
};

/** Aviso al confirmar sin servicios; se retira solo al elegir uno. */
const AVISO_SIN_SERVICIOS = 'Selecciona al menos un servicio para la reserva.';

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
    ResumenReservaComponent,
    MisCitasComponent
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
  cargandoBarberos = false;
  errorBarberos: string | null = null;
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

    // Mis próximas citas (cancelar / reprogramar)
  readonly avisoMinutos = AVISO_MINUTOS;
  citas: CitaCliente[] = [];
  cargandoCitas = false;
  errorCitas = '';
  citaOcupadaId: string | null = null;
  /** Cita que se está reprogramando: barbería, barbero y servicios quedan fijos. */
  reprogramando: CitaCliente | null = null;
  /** Barbero que se debe seleccionar cuando termine de cargar la lista. */
  private barberoPendienteId: string | null = null;

  /** Aviso dentro de la página (reemplaza las ventanas emergentes del navegador). */
  aviso: { tipo: 'exito' | 'error'; texto: string } | null = null;
  private avisoTimer?: ReturnType<typeof setTimeout>;

  // Estado interno del día/barbero consultado (permite recalcular slots sin volver al backend)
  private turnoActual: Turno | null = null;
  private ocupadosActuales: RangoOcupado[] = [];

  ngOnInit(): void {
    // El servicio de disponibilidad vive toda la sesión: al entrar se descartan
    // horarios en caché que el administrador pudo crear o cambiar después.
    this.availability.clearCache();
    this.actualizarMes();
    this.cargarBarberias();
    this.cargarCitas();
  }

  // ───────────────────────── Carga de datos ─────────────────────────

  private cargarBarberias(): void {
    this.reservationService.getBarberias().subscribe({
      next: (res: any) => {
        this.barberias = extraerLista<Barberia>(res);
        // Las citas pueden haber cargado antes que las barberías: se completa el nombre.
        this.citas = this.citas.map(cita => ({
          ...cita,
          barbershopName: this.barberias.find(b => idBarberia(b) === cita.barbershopId)?.name ?? cita.barbershopName
        }));

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

    // Solo barberos reservables: activos y con rol de barbero (no bloqueados ni el administrador).
    this.cargandoBarberos = true;
    this.errorBarberos = null;
    this.reservationService.getBookableBarbers(barberiaId).subscribe({
      next: (res: any) => {
        if (this.selectedBarberiaId !== barberiaId) return; // respuesta de otra barbería
        this.cargandoBarberos = false;
        this.barberosFiltrados = extraerLista(res).map(toBarbero);

        // Ningún barbero queda elegido por defecto: el cliente lo escoge. Solo
        // al reprogramar se fija el barbero de la cita.
        const pendiente = this.barberosFiltrados.find(b => b.id === this.barberoPendienteId) ?? null;
        this.barberoPendienteId = null;
        this.selectedBarbero = pendiente;
        this.slotsHorarios = [];
        if (pendiente && this.selectedFecha) {
          this.generarHorariosDisponibles();
        }
      },
      error: (err: any) => {
        if (this.selectedBarberiaId !== barberiaId) return;
        console.error('Error al cargar empleados para la barbería:', err);
        this.cargandoBarberos = false;
        this.errorBarberos = toUserMessage(err, {
          DEFAULT: 'No fue posible consultar los barberos de esta barbería.'
        });
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
        // Ningún servicio viene marcado: el cliente elige los que quiere.
        this.selectedServicesIds = [];
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
    if (this.reprogramando && barberiaId !== this.reprogramando.barbershopId) return;
    this.selectedBarberiaId = barberiaId;
    this.selectedHora = '';
    this.availability.clearCache();
    if (barberiaId) {
      this.cargarDiasNoLaborables(barberiaId);
      this.cargarEmpleados(barberiaId);
      this.cargarServicios(barberiaId);
    }
  }

  reintentarBarberos(): void {
    if (this.selectedBarberiaId) {
      this.cargarEmpleados(this.selectedBarberiaId);
    }
  }

  onBarberoSelect(barbero: Barbero): void {
    if (this.reprogramando && barbero.id !== this.reprogramando.employeeId) return;
    this.selectedBarbero = barbero;
    this.selectedHora = '';
    if (this.selectedDia) {
      this.generarHorariosDisponibles();
    }
  }

  toggleServicio(servicio: Servicio): void {
    const yaElegido = this.selectedServicesIds.includes(servicio.id);

    if (yaElegido) {
      this.selectedServicesIds = this.selectedServicesIds.filter(id => id !== servicio.id);
    } else {
      this.selectedServicesIds = [...this.selectedServicesIds, servicio.id];
    }

    this.recalcularResumen();
    this.recalcularSlots(); // la duración cambió: algunos huecos dejan de caber

    // El aviso de "sin servicios" deja de aplicar en cuanto hay uno elegido.
    if (this.selectedServicesIds.length > 0 && this.aviso?.texto === AVISO_SIN_SERVICIOS) {
      this.cerrarAviso();
    }
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

    const duracion = this.reprogramando
      ? this.reprogramando.duration
      : this.serviciosSeleccionados.reduce((acc, s) => acc + (Number(s.duration) || 0), 0);
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

  /** Botón del resumen: crea la reserva o confirma la nueva hora de la cita. */
  confirmar(): void {
    if (this.reprogramando) {
      this.confirmarReprogramacion();
    } else {
      this.crearReserva();
    }
  }

  crearReserva(): void {
    if (this.isLoading) return;
    this.cerrarAviso();

    if (!this.currentUser.uid) {
      this.mostrarAviso('error', 'Tu perfil aún se está cargando. Espera un momento e inténtalo de nuevo.');
      return;
    }

    if (!this.selectedBarbero || !this.selectedHora || !this.selectedFecha) {
      this.mostrarAviso('error', 'Selecciona un barbero, una fecha y un horario disponible.');
      return;
    }

    if (this.selectedServicesIds.length === 0) {
      this.mostrarAviso('error', AVISO_SIN_SERVICIOS);
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
      this.mostrarAviso('error', resultado.mensaje);
      return;
    }

    const payload = resultado.payload;
    console.log('📦 Payload enviado a /reservation-service/create:', JSON.stringify(payload, null, 2));

    this.isLoading = true;
    this.reservationService.createReservation(payload).subscribe({
      next: () => {
        this.isLoading = false;
        this.mostrarAviso('exito', '¡Reserva creada correctamente!');
        this.cargarCitas();
        this.selectedHora = '';
        this.generarHorariosDisponibles(); // vuelve a leer la BD y marca el slot como ocupado
      },
      error: (err: any) => {
        this.isLoading = false;
        console.error('❌ Error al crear reserva:', err.status, err.error, '\nPayload enviado:', payload);
        this.mostrarAviso('error', mensajeErrorReserva(err));
      }
    });
  }

  cerrarAviso(): void {
    clearTimeout(this.avisoTimer);
    this.aviso = null;
  }

  /** Los avisos de éxito se ocultan solos; los de error quedan hasta cerrarlos. */
  private mostrarAviso(tipo: 'exito' | 'error', texto: string): void {
    clearTimeout(this.avisoTimer);
    this.aviso = { tipo, texto };
    if (tipo === 'exito') {
      this.avisoTimer = setTimeout(() => (this.aviso = null), 6000);
    }
  }

  // ───────────────────────── Mis próximas citas ─────────────────────────

  cargarCitas(): void {
    const clienteId = this.sessionService.getClientId();
    if (!clienteId) return;

    this.cargandoCitas = true;
    this.errorCitas = '';

    this.reservationService.getReservationHistory('customer', clienteId).subscribe({
      next: items => {
        const ahora = Date.now();
        const limite = ahora + AVISO_MINUTOS * 60_000;
        this.citas = items
          .filter(item => ESTADOS_ACTIVOS.has(String(item.status).toUpperCase()))
          .map(item => this.aCita(item, limite))
          .filter(cita => cita.end.getTime() >= ahora)
          .sort((a, b) => a.start.getTime() - b.start.getTime());
        this.cargandoCitas = false;
      },
      error: err => {
        this.citas = [];
        this.errorCitas = toUserMessage(err, { DEFAULT: 'No fue posible cargar tus citas.' });
        this.cargandoCitas = false;
      }
    });
  }

  cancelarCita(cita: CitaCliente): void {
    if (this.citaOcupadaId || !window.confirm('¿Seguro que deseas cancelar esta cita?')) return;

    this.citaOcupadaId = cita.id;
    this.reservationService.cancelReservation(cita.id).subscribe({
      next: () => {
        this.citaOcupadaId = null;
        this.mostrarAviso('exito', 'Cita cancelada.');
        this.cargarCitas();
        if (this.selectedBarbero && this.selectedFecha) this.generarHorariosDisponibles();
      },
      error: err => {
        this.citaOcupadaId = null;
        this.mostrarAviso('error', toUserMessage(err, { DEFAULT: 'No fue posible cancelar la cita.' }));
      }
    });
  }

  /** Abre el calendario con la barbería y el barbero de la cita para elegir otra hora. */
  iniciarReprogramacion(cita: CitaCliente): void {
    this.cerrarAviso();
    this.reprogramando = cita;
    this.selectedHora = '';
    this.recalcularResumen();

    this.barberoPendienteId = cita.employeeId;
    if (this.selectedBarberiaId === cita.barbershopId && this.barberosFiltrados.some(b => b.id === cita.employeeId)) {
      this.barberoPendienteId = null;
      this.onBarberoSelect(this.barberosFiltrados.find(b => b.id === cita.employeeId)!);
    } else {
      this.onBarberiaChange(cita.barbershopId);
    }
  }

  cancelarReprogramacion(): void {
    this.reprogramando = null;
    this.selectedHora = '';
    this.recalcularResumen();
    this.recalcularSlots();
  }

  private confirmarReprogramacion(): void {
    const cita = this.reprogramando;
    if (!cita || this.isLoading) return;
    if (!this.selectedFecha || !this.selectedHora) {
      this.mostrarAviso('error', 'Elige la nueva fecha y hora.');
      return;
    }

    this.isLoading = true;
    const startTime = `${this.selectedFecha}T${this.selectedHora}:00-05:00`;

    this.reservationService.rescheduleReservation(cita.id, startTime).subscribe({
      next: () => {
        this.isLoading = false;
        this.reprogramando = null;
        this.selectedHora = '';
        this.recalcularResumen();
        this.mostrarAviso('exito', 'Cita reprogramada. Queda pendiente de confirmación del barbero.');
        this.cargarCitas();
        this.generarHorariosDisponibles();
      },
      error: err => {
        this.isLoading = false;
        const code = toApiError(err).code;
        this.mostrarAviso('error', toUserMessage(err, {
          DEFAULT: code === 'RES_011' ? 'Ese horario ya está ocupado. Elige otro.' : 'No fue posible reprogramar la cita.'
        }));
      }
    });
  }

  private aCita(item: ReservationHistoryItem, limiteModificacion: number): CitaCliente {
    const start = new Date(item.startTime);
    const end = item.endTime ? new Date(item.endTime) : new Date(start.getTime() + (Number(item.duration) || 0) * 60_000);
    const status = String(item.status).toUpperCase();
    const barberia = this.barberias.find(b => idBarberia(b) === item.barbershopId);

    return {
      id: item.id,
      barbershopId: item.barbershopId,
      employeeId: item.employeeId,
      barbershopName: barberia?.name ?? 'Barbería',
      start,
      end,
      duration: Number(item.duration) || Math.round((end.getTime() - start.getTime()) / 60_000),
      status,
      statusLabel: ETIQUETAS_ESTADO[status] ?? status,
      services: item.services ?? [],
      modifiable: start.getTime() >= limiteModificacion && item.reservationType !== 'VIRTUAL_QUEUE'
    };
  }
}
