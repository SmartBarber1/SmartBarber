/**
 * Datos quemados para demostrar el dashboard sin backend.
 * Se genera un histórico de reservas con un generador pseudoaleatorio con
 * semilla, de modo que los valores son estables entre recargas.
 */

import { addDays, toIsoDate } from '../../domain/models/statistics-period';

export type MockReservationStatus = 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export type MockReservationType = 'SERVICE_RESERVATION' | 'VIRTUAL_QUEUE';

export interface MockBarber {
  id: string;
  name: string;
  /** Reservas base por día. */
  load: number;
  /** Ajuste de calificación respecto al promedio. */
  ratingBias: number;
}

export interface MockService {
  id: string;
  name: string;
  price: number;
  duration: number;
  weight: number;
}

export interface MockReservation {
  date: string;
  weekday: number;
  hour: number;
  barberId: string;
  customerId: string;
  serviceIds: string[];
  type: MockReservationType;
  status: MockReservationStatus;
  durationMinutes: number;
  revenue: number;
  rating: number | null;
  waitMinutes: number | null;
  /** Turno de cola que ocupó un espacio liberado por cancelación o inasistencia. */
  recoveredSlot: boolean;
}

export const MOCK_BARBERS: MockBarber[] = [
  { id: 'brb-01', name: 'Carlos Ruiz', load: 9, ratingBias: 0.2 },
  { id: 'brb-02', name: 'Andrés Gómez', load: 8, ratingBias: 0 },
  { id: 'brb-03', name: 'Julián Torres', load: 7, ratingBias: 0.1 },
  { id: 'brb-04', name: 'Mateo Rojas', load: 5, ratingBias: -0.3 }
];

export const MOCK_SERVICES: MockService[] = [
  { id: 'srv-01', name: 'Corte clásico', price: 25_000, duration: 30, weight: 30 },
  { id: 'srv-02', name: 'Corte + barba', price: 40_000, duration: 50, weight: 22 },
  { id: 'srv-03', name: 'Fade premium', price: 35_000, duration: 45, weight: 18 },
  { id: 'srv-04', name: 'Arreglo de barba', price: 18_000, duration: 20, weight: 14 },
  { id: 'srv-05', name: 'Afeitado tradicional', price: 22_000, duration: 30, weight: 9 },
  { id: 'srv-06', name: 'Diseño de cejas', price: 8_000, duration: 10, weight: 7 }
];

/** Jornada laboral: 9:00 a 19:00 con una hora de almuerzo, todos los días. */
export const WORKDAY_MINUTES = 540;

export const OPENING_HOUR = 9;

export const CLOSING_HOUR = 19;

/** Días de histórico generados (cubre el rango máximo más su periodo anterior). */
const HISTORY_DAYS = 740;

const CUSTOMER_POOL = 420;

/** Peso de demanda por hora de inicio (9:00 a 18:00). */
const HOUR_WEIGHTS = [3, 5, 7, 6, 2, 4, 5, 7, 9, 6];

const datasetCache = new Map<string, MockReservation[]>();

export function getMockReservations(barbershopId: string, today = new Date()): MockReservation[] {
  const cacheKey = `${barbershopId}|${toIsoDate(today)}`;
  const cached = datasetCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const dataset = generateReservations(barbershopId, today);
  datasetCache.clear();
  datasetCache.set(cacheKey, dataset);

  return dataset;
}

function generateReservations(barbershopId: string, today: Date): MockReservation[] {
  const random = mulberry32(hashString(barbershopId));
  const reservations: MockReservation[] = [];

  for (let offset = HISTORY_DAYS; offset >= 0; offset--) {
    const day = addDays(today, -offset);
    const weekday = day.getDay() === 0 ? 7 : day.getDay();

    // Crecimiento suave del negocio en el tiempo; más demanda viernes y sábado, menos el domingo.
    const growth = 0.8 + 0.2 * (1 - offset / HISTORY_DAYS);
    const weekdayFactor = weekday === 7 ? 0.5 : 1;
    const weekendBoost = weekday === 5 || weekday === 6 ? 3 : 0;
    const date = toIsoDate(day);

    for (const barber of MOCK_BARBERS) {
      const scheduled = Math.round((barber.load + weekendBoost) * growth * weekdayFactor + random() * 3 - 1);
      let freedSlots = 0;

      for (let i = 0; i < scheduled; i++) {
        const roll = random();
        const status: MockReservationStatus =
          roll < 0.8 ? 'COMPLETED' : roll < 0.91 ? 'CANCELLED' : 'NO_SHOW';

        if (status !== 'COMPLETED') {
          freedSlots++;
        }

        reservations.push(
          buildReservation(random, date, weekday, barber, 'SERVICE_RESERVATION', status, false)
        );
      }

      const queueTurns = Math.floor(random() * (weekendBoost ? 5 : 3));
      const recovered = Math.min(queueTurns, Math.round(freedSlots * (0.4 + random() * 0.4)));

      for (let i = 0; i < queueTurns; i++) {
        reservations.push(
          buildReservation(random, date, weekday, barber, 'VIRTUAL_QUEUE', 'COMPLETED', i < recovered)
        );
      }
    }
  }

  return reservations;
}

function buildReservation(
  random: () => number,
  date: string,
  weekday: number,
  barber: MockBarber,
  type: MockReservationType,
  status: MockReservationStatus,
  recoveredSlot: boolean
): MockReservation {
  const services = [pickWeighted(random, MOCK_SERVICES, s => s.weight)];

  if (random() < 0.12) {
    services.push(MOCK_SERVICES[5]);
  }

  const baseDuration = services.reduce((sum, s) => sum + s.duration, 0);
  const completed = status === 'COMPLETED';
  const hourIndex = pickWeighted(random, HOUR_WEIGHTS.map((weight, index) => ({ index, weight })), h => h.weight).index;
  const rated = completed && random() < 0.7;

  return {
    date,
    weekday,
    hour: OPENING_HOUR + hourIndex,
    barberId: barber.id,
    customerId: `cst-${Math.floor(random() * CUSTOMER_POOL)}`,
    serviceIds: [...new Set(services.map(s => s.id))],
    type,
    status,
    durationMinutes: completed ? Math.max(10, baseDuration + Math.round(random() * 13 - 5)) : 0,
    revenue: completed ? services.reduce((sum, s) => sum + s.price, 0) : 0,
    rating: rated ? clamp(Math.round((4.3 + barber.ratingBias + random() * 1.4 - 0.6) * 2) / 2, 1, 5) : null,
    waitMinutes: type === 'VIRTUAL_QUEUE' ? Math.round(8 + random() * 22 + (hourIndex >= 7 ? 8 : 0)) : null,
    recoveredSlot
  };
}

function pickWeighted<T>(random: () => number, items: T[], weightOf: (item: T) => number): T {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0);
  let threshold = random() * total;

  for (const item of items) {
    threshold -= weightOf(item);

    if (threshold <= 0) {
      return item;
    }
  }

  return items[items.length - 1];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
