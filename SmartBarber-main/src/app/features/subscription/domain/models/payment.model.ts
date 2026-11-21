export type PaymentStatus =
  | 'PAID'
  | 'PENDING'
  | 'FAILED'
  | 'REFUNDED'
  | 'CANCELLED';

export interface Payment {
  id: string;
  date: string;
  status: PaymentStatus;
  /** Valor cobrado (precio del plan menos el descuento). */
  amount: number;
  currency: string;
  /** Referencia de la orden en la pasarela. */
  transactionReference: string;
  description: string;
  /** Precio del plan antes del descuento. */
  subtotal?: number;
  discount?: number;
  /** Vigencia que cubre el pago (solo si el plan llegó a activarse). */
  periodStart?: string | null;
  periodEnd?: string | null;
}
