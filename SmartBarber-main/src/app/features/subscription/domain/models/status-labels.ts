/** Nombres en español de los estados que envía el backend. */

const SUBSCRIPTION_STATUS_LABELS: Readonly<Record<string, string>> = {
    ACTIVE: 'Activa',
    APPROVED: 'Aprobada (inicia al terminar el periodo actual)',
    PENDING: 'Pendiente de pago',
    DECLINED: 'Rechazada',
    NOT_SUBSCRIPTION: 'Sin suscripción',
    EXPIRED: 'Vencida',
    REFUNDED: 'Reembolsada'
};

const PAYMENT_STATUS_LABELS: Readonly<Record<string, string>> = {
    PENDING: 'pendiente',
    APPROVED: 'aprobado',
    REJECTED: 'rechazado',
    DECLINED: 'rechazado',
    CANCELED: 'cancelado',
    CANCELLED: 'cancelado',
    REFUNDED: 'reembolsado',
    ERROR: 'con error'
};

export function subscriptionStatusLabel(status: string | null | undefined): string {
    return (status && SUBSCRIPTION_STATUS_LABELS[status.toUpperCase()]) || 'Estado desconocido';
}

/** Mensaje para un evento de pago recibido por el WebSocket. */
export function paymentUpdateMessage(event: unknown): string {
    const status =
        typeof event === 'object' && event !== null && 'status' in event && typeof event.status === 'string'
            ? event.status.toUpperCase()
            : null;

    if (!status) {
        return 'Recibimos una actualización del pago. Consulta el estado del plan.';
    }

    const label = PAYMENT_STATUS_LABELS[status];

    return label
        ? `El pago quedó ${label}.`
        : 'Recibimos una actualización del pago. Consulta el estado del plan.';
}
