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

// Servicio ofrecido por una barbería (lo usan appointment, servicio-list y resumen-reserva)
export interface Servicio {
  id: number;
  id_servicio?: number;
  name: string;
  description?: string;
  duration?: number;
  price: number;
  special_price?: number;
  offert?: boolean;
  [key: string]: any; // el backend puede enviar campos extra
}

export type HistoryScope = 'customer' | 'employee' | 'barbershop';

export interface ReservationHistoryItem {
  id: string;
  barbershopId: string;
  customerId: string;
  employeeId: string;
  status: string;
  reservationType: string;
  notes?: string;
  duration: number;
  startTime: string;
  endTime: string;
  queueEntryTime?: string | null;
  creationDate: string;
  updatedDate: string;
}