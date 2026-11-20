export interface Information {
  id: string;
  name: string;
}

export interface BarbershopInformation extends Information {
  location: string;
}

export interface OpenAndCloseEventQueue {
  type: string;
  employee: Information;
  barbershop: BarbershopInformation;
}

export interface QueueEvent {
  type: string;
  payload: QueueSnapshotResponseEvent;
}

export interface QueueSnapshotResponseEvent {
  employeeId: string;
  acceptingClients: boolean;
  currentTurn: QueueTurn | null;
  waitingTurns: QueueTurn[];
  updatedAt: string;
}

export interface QueueTurn {
  reservationId: string;
  /** null cuando un cliente ve el turno de otra persona (sin datos personales). */
  customer: Customer | null;
  position: number;
  estimatedWaitMinutes: number;
  durationMinutes: number;
  status: string;
  /** Nombres de los servicios del turno (vacío en turnos de otros clientes). */
  services?: string[];
  /** Nota que dejó el cliente al unirse. */
  notes?: string | null;
  reservationType?: string | null;
  /** El turno es del cliente que consulta. */
  mine?: boolean;
}

/** Texto del tipo de reserva. */
export function reservationTypeLabel(type: string | null | undefined): string {
  return type === 'SERVICE_RESERVATION' ? 'Reserva agendada' : 'Cola virtual';
}

export interface Customer {
  id: string;
  name: string;
  cell: string;
}

export interface NotificationEvent {
  type: string;
  payload: NotificationPayload;

}

export interface NotificationPayload {
  barberId: string;
  barberName: string;
  barberShopId: string;
  barberShopName: string;
}