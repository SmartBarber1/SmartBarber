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
  customer: Customer;
  position: number;
  estimatedWaitMinutes: number;
  durationMinutes: number;
  status: string;
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