import { toUserMessage } from '../../../core/errors';

/** Convierte el error HTTP de crear una reserva en un mensaje claro en español. */
export function mensajeErrorReserva(err: unknown): string {
  return toUserMessage(err, {
    VALIDATION: 'Revisa los datos de la reserva.',
    DEFAULT: 'No fue posible crear la reserva. Inténtalo nuevamente.'
  });
}
