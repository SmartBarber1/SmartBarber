export interface BarberServicePayload {
  id?: number;
  barberiaId: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  offert: boolean;
  special_price: number;
  status?: boolean;
  isActive?: boolean;
}

/** Lo que emite el formulario al guardar (ya validado) */
export interface ServicioFormValue {
  barberiaId: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  offert: boolean;
  special_price: number;
  isActive: boolean;
}

/** Opción lista para pintar en el select de barberías */
export interface BarberiaOpcion {
  id: string;
  label: string;
}
