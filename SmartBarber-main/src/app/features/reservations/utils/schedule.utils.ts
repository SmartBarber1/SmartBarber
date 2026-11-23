import { RangoOcupado, SlotHorario } from '../models/reservation.model';
import { EstadoBarbero, Turno } from '../models/schedule.model';
import { ahoraEnMinutos, hoyColombia, horaAMinutos, isoAMinutosLocal, minutosAHora } from './time.utils';

/** Separación entre franjas reservables, en minutos. */
export const INTERVALO_FRANJA_MIN = 60;

/** Acepta objeto o lista, distintos nombres de campo y turnos por día de la semana. */
export function extraerTurno(schedule: any, fecha: string): Turno | null {
  const raw = schedule?.data ?? schedule;
  if (!raw) return null;
  const lista: any[] = Array.isArray(raw) ? raw : [raw];

  const [y, m, d] = fecha.split('-').map(Number);
  const js = new Date(y, m - 1, d).getDay();
  const dow = js === 0 ? 7 : js; // 1 = lunes ... 7 = domingo
  const en = ['', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  const es = ['', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];

  const diaDe = (x: any): number | null => {
    const v = x?.dayOfWeek ?? x?.day ?? x?.dia ?? x?.dia_semana;
    if (v === undefined || v === null) return null;
    if (typeof v === 'number') return v;
    const s = String(v).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (en.indexOf(s) > 0) return en.indexOf(s);
    if (es.indexOf(s) > 0) return es.indexOf(s);
    return Number(s) || null;
  };

  const sinDias = lista.every(x => diaDe(x) === null);
  const item = sinDias ? lista[0] : lista.find(x => diaDe(x) === dow);
  if (!item) return null;

  const hora = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = item[k];
      if (v) {
        const s = String(v);
        return s.includes('T') ? s.split('T')[1].slice(0, 5) : s.slice(0, 5);
      }
    }
    return null;
  };

  const inicio = hora('startTime', 'hora_inicio', 'horaInicio', 'start', 'openingTime', 'opening_time');
  const fin = hora('endTime', 'hora_fin', 'horaFin', 'end', 'closingTime', 'closing_time');
  if (!inicio || !fin) return null;

  const almuerzoInicio = hora('lunchStartTime', 'hora_inicio_almuerzo', 'horaInicioAlmuerzo', 'lunchStart');
  const almuerzoFin = hora('lunchEndTime', 'hora_fin_almuerzo', 'horaFinAlmuerzo', 'lunchEnd');
  const v = item['vacation'] ?? item['vacaciones'] ?? item['onVacation'] ?? false;
  const vacaciones = v === true || String(v).toLowerCase() === 'true';

  return { inicio, fin, almuerzoInicio, almuerzoFin, vacaciones };
}

/** Reservas del backend -> rangos en minutos (hora Colombia) */
export function mapOcupados(reservas: any): RangoOcupado[] {
  const lista = reservas?.data ?? reservas ?? [];
  return (Array.isArray(lista) ? lista : [])
    .filter((x: any) => x?.startTime && x?.endTime)
    .map((x: any) => ({
      ini: isoAMinutosLocal(x.startTime),
      fin: isoAMinutosLocal(x.endTime)
    }));
}

export function construirSlots(
  turno: Turno,
  ocupados: RangoOcupado[],
  duracion: number,
  fecha: string
): SlotHorario[] {
  const start = horaAMinutos(turno.inicio);
  const end = horaAMinutos(turno.fin);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];

  // Almuerzo del barbero (si está configurado): no se puede reservar encima
  const almIni = turno.almuerzoInicio ? horaAMinutos(turno.almuerzoInicio) : NaN;
  const almFin = turno.almuerzoFin ? horaAMinutos(turno.almuerzoFin) : NaN;
  const hayAlmuerzo = Number.isFinite(almIni) && Number.isFinite(almFin) && almFin > almIni;

  const hoy = hoyColombia();
  const esHoy = fecha === hoy;
  const diaPasado = fecha < hoy; // formato YYYY-MM-DD: la comparación de texto es válida
  const ahora = ahoraEnMinutos();

  // Franjas cada hora desde el inicio de la jornada (ej. 6:00, 7:00, 8:00...).
  const slots: SlotHorario[] = [];
  for (let min = start; min + INTERVALO_FRANJA_MIN <= end; min += INTERVALO_FRANJA_MIN) {
    const pasado = diaPasado || (esHoy && min <= ahora);
    const noCabe = min + duracion > end;
    // Choca si el servicio completo [min, min + duracion) se cruza con una reserva existente o con el almuerzo
    const choca = ocupados.some(o => min < o.fin && min + duracion > o.ini);
    const enAlmuerzo = hayAlmuerzo && min < almFin && min + duracion > almIni;

    let motivo: string | undefined;
    if (pasado) motivo = 'Pasado';
    else if (choca) motivo = 'Ocupado';
    else if (enAlmuerzo) motivo = 'Almuerzo';
    else if (noCabe) motivo = 'Sin tiempo';

    slots.push({ hora: minutosAHora(min), disponible: !motivo, motivoOcupado: motivo });
  }
  return slots;
}

/** Estado "en vivo" del barbero (solo tiene sentido si la fecha es hoy). */
export function calcularEstadoBarbero(ocupados: RangoOcupado[], turno: Turno, fecha: string): EstadoBarbero {
  const esHoy = fecha === hoyColombia();
  const ahora = ahoraEnMinutos();

  const ocupadoAhora = esHoy && ocupados.some(o => ahora >= o.ini && ahora < o.fin);
  const enAlmuerzoAhora = esHoy && !!turno.almuerzoInicio && !!turno.almuerzoFin &&
    ahora >= horaAMinutos(turno.almuerzoInicio) && ahora < horaAMinutos(turno.almuerzoFin);

  if (ocupadoAhora) return { estado: 'ocupado', texto: 'Ocupado' };
  if (enAlmuerzoAhora) return { estado: 'almuerzo', texto: 'Almuerzo' };
  return { estado: 'libre', texto: 'Libre' };
}
