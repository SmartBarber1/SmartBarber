import { CreateReservationPayload } from '../models/reservation.model';

export interface PayloadInput {
  customerId: string;
  employeeId: string;
  barbershopId: string;
  serviceIds: any[];
  fecha: string;   // YYYY-MM-DD
  hora: string;    // HH:mm
}

export type PayloadResult =
  | { ok: true; payload: CreateReservationPayload }
  | { ok: false; mensaje: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OFFSET_COLOMBIA = '-05:00';

export function buildReservationPayload(input: PayloadInput): PayloadResult {
  const employeeId = String(input.employeeId || '').trim();
  const barbershopId = String(input.barbershopId || '').trim();
  const customerId = input.customerId || '';

  // Empleado y sede deben ser UUID, y ningún id puede repetirse en otro campo
  if (!UUID_RE.test(employeeId) || !UUID_RE.test(barbershopId) ||
      customerId === employeeId || customerId === barbershopId) {
    console.error('❌ Ids inconsistentes, no se envía la reserva:', { customerId, employeeId, barbershopId });
    return {
      ok: false,
      mensaje: 'Los datos del barbero o de la sede no son válidos. Recarga la página e inténtalo de nuevo.'
    };
  }

  // Servicios: lista de números si todos los ids son numéricos; si no, se envían tal cual (texto)
  const rawIds: string[] = input.serviceIds.map((s: any) =>
    String(typeof s === 'object' ? (s.id ?? s.id_servicio) : s).trim()
  );
  const todosNumericos = rawIds.every(id => /^\d+$/.test(id));
  const reservationServiceId: any[] = todosNumericos ? rawIds.map(Number) : rawIds;

  return {
    ok: true,
    payload: {
      customerId,
      employeeId,
      barbershopId,
      reservationServiceId,
      startTime: `${input.fecha}T${input.hora}:00${OFFSET_COLOMBIA}`,
      notes: ''
    }
  };
}
