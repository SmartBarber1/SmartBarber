import { BarberServicePayload, BarberiaOpcion, ServicioFormValue } from '../models/servicio.model';

/** El backend puede devolver una lista o un solo objeto: siempre una lista. */
function comoLista(data: any): any[] {
  if (Array.isArray(data)) return data;
  return data ? [data] : [];
}

/** Respuesta del backend -> servicios para la vista (isActive sale de status/isActive) */
export function toServiciosView(data: any): BarberServicePayload[] {
  return comoLista(data).map((item: any) => ({
    ...item,
    isActive: item.status ?? item.isActive ?? true
  }));
}

/** Respuesta del backend -> opciones del select (soporta campos en inglés y español) */
export function toBarberiaOpciones(data: any): BarberiaOpcion[] {
  return comoLista(data).map((b: any) => ({
    id: b.id,
    label: `${b.name || b.nombre} - ${b.address || b.direccion}`
  }));
}

/** Valores del formulario -> body que espera create/update del backend */
export function buildServicePayload(v: ServicioFormValue) {
  return {
    barberiaId: v.barberiaId,
    name: v.name,
    description: v.description,
    duration: v.duration,
    price: v.price,
    offert: v.offert,
    special_price: v.special_price
  };
}
