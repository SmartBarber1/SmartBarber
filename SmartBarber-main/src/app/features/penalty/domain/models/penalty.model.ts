/**
 * Política de penalización de clientes (RF-22, RF-82 a RF-85).
 * Regla: N inasistencias en P días en una barbería → R días sin poder reservar
 * allí. Nunca cobra dinero.
 */
export interface PenaltyPolicy {
  barbershopId: string | null;
  enabled: boolean;
  toleranceMinutes: number;
  noShowThreshold: number;
  countingPeriodDays: number;
  restrictionDays: number;
  cancelNoticeHours: number;
  allowReschedule: boolean;
  rescheduleNoticeHours: number;
  updatedAt?: string | null;
}

export type PenaltyPolicySettings = Omit<PenaltyPolicy, 'barbershopId' | 'updatedAt'>;

/** Límites de cada parámetro (los mismos que valida el servidor). */
export const PENALTY_LIMITS = {
  toleranceMinutes: { min: 5, max: 30 },
  noShowThreshold: { min: 2, max: 5 },
  countingPeriodDays: { min: 15, max: 90 },
  restrictionDays: { min: 1, max: 30 },
  cancelNoticeHours: { min: 1, max: 72 },
  rescheduleNoticeHours: { min: 1, max: 72 }
} as const;

export const DEFAULT_PENALTY_POLICY: PenaltyPolicy = {
  barbershopId: null,
  enabled: true,
  toleranceMinutes: 15,
  noShowThreshold: 3,
  countingPeriodDays: 30,
  restrictionDays: 15,
  cancelNoticeHours: 24,
  allowReschedule: true,
  rescheduleNoticeHours: 24
};

export type PenaltyState = 'ACTIVE' | 'WITH_NO_SHOWS' | 'WARNED' | 'RESTRICTED';

export interface PenaltyNoShow {
  reservationId: string;
  occurredAt: string;
  countsUntil: string;
}

export interface PenaltyRestriction {
  id: string;
  startsAt: string;
  endsAt: string;
  noShowCount: number;
}

/** Estado de un cliente en una barbería. */
export interface PenaltyStanding {
  customerId: string;
  customerName: string | null;
  barbershopId: string;
  barbershopName: string;
  state: PenaltyState;
  noShowCount: number;
  threshold: number;
  policyEnabled: boolean;
  noShows: PenaltyNoShow[];
  restriction: PenaltyRestriction | null;
  policy: PenaltyPolicy;
}

export const PENALTY_STATE_LABELS: Readonly<Record<PenaltyState, string>> = {
  ACTIVE: 'Sin inasistencias',
  WITH_NO_SHOWS: 'Con inasistencias',
  WARNED: 'En advertencia',
  RESTRICTED: 'Restringido'
};

function plural(value: number, singular: string, pluralForm: string): string {
  return `${value} ${value === 1 ? singular : pluralForm}`;
}

/**
 * La política en una línea, igual para el cliente (junto al botón de
 * confirmar) y para la vista previa del administrador.
 */
export function policySummary(policy: PenaltyPolicy): string {
  const cancel = `Puedes cancelar hasta ${plural(policy.cancelNoticeHours, 'hora', 'horas')} antes.`;
  if (!policy.enabled) {
    return cancel;
  }
  return `Si faltas ${plural(policy.noShowThreshold, 'vez', 'veces')} en ${policy.countingPeriodDays} días sin cancelar, `
    + `no podrás reservar aquí durante ${plural(policy.restrictionDays, 'día', 'días')}. ${cancel}`;
}
