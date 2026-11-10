export interface CreateReservationPayload {
  customerId: string;
  barbershopId: string;
  employeeId: string;
  reservationServiceId: number[];
  startTime: string;
  notes: string;
}

export interface Barberia {
  id: string;
  name: string;
  description: string;
  location: string;
  phone?: string;
  status?: string;
}

export interface Barbero {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  status?: string;
  especialidad?: string;
  estado?: string;
  estadoTexto?: string;
  foto?: string;
  scheduleId?: number | string | null;
}

export interface SlotHorario {
  hora: string;
  disponible: boolean;
  motivoOcupado?: string;
}

export interface RangoOcupado {
  ini: number; // minutos desde las 00:00 (hora Colombia)
  fin: number;
}
