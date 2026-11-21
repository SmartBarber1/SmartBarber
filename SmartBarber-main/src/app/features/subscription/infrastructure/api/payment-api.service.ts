import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { PaymentRepository } from '../../domain/repositories/payment.repository';
import { PaymentHistory, PaymentHistoryFilters } from '../../domain/models/payment-history.model';
import { Payment, PaymentStatus } from '../../domain/models/payment.model';

/** Estado de la transacción en el back. */
type TransactionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED' | 'REFUNDED';

interface PaymentRecordDto {
  transactionId: string;
  orderId: string;
  subscriptionBarberId: string;
  planName: string;
  amount: number;
  discount: number;
  subtotal: number;
  status: TransactionStatus;
  createdAt: string;
  updatedAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

interface PaymentHistoryPageDto {
  content: PaymentRecordDto[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

const TO_PAYMENT_STATUS: Readonly<Record<TransactionStatus, PaymentStatus>> = {
  PENDING: 'PENDING',
  APPROVED: 'PAID',
  REJECTED: 'FAILED',
  CANCELED: 'CANCELLED',
  REFUNDED: 'REFUNDED'
};

const TO_TRANSACTION_STATUS: Readonly<Record<PaymentStatus, TransactionStatus>> = {
  PENDING: 'PENDING',
  PAID: 'APPROVED',
  FAILED: 'REJECTED',
  CANCELLED: 'CANCELED',
  REFUNDED: 'REFUNDED'
};

/**
 * Historial de pagos de suscripción. La barbería la determina el back a partir
 * de la sesión del administrador; aquí solo se envían filtros y paginación.
 */
@Injectable()
export class PaymentApiService extends PaymentRepository {

  private readonly http = inject(HttpClient);

  override getPaymentHistory(filters: PaymentHistoryFilters): Observable<PaymentHistory> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('size', filters.size);

    if (filters.status) {
      params = params.set('status', TO_TRANSACTION_STATUS[filters.status]);
    }
    if (filters.fromDate) {
      params = params.set('fromDate', filters.fromDate);
    }
    if (filters.toDate) {
      params = params.set('toDate', filters.toDate);
    }

    return this.http
      .get<PaymentHistoryPageDto>(
        `${environment.apiUrl}/subscription-barbershop-service/payment-history`,
        { params }
      )
      .pipe(map(page => ({
        content: (page?.content ?? []).map(toPayment),
        page: page?.page ?? filters.page,
        size: page?.size ?? filters.size,
        totalElements: page?.totalElements ?? 0,
        totalPages: page?.totalPages ?? 0
      })));
  }
}

function toPayment(dto: PaymentRecordDto): Payment {
  return {
    id: dto.transactionId,
    date: dto.createdAt,
    status: TO_PAYMENT_STATUS[dto.status] ?? 'PENDING',
    amount: Number(dto.amount) || 0,
    currency: 'COP',
    transactionReference: dto.orderId,
    description: dto.planName || 'Plan SmartBarber',
    subtotal: Number(dto.subtotal) || 0,
    discount: Number(dto.discount) || 0,
    periodStart: dto.periodStart,
    periodEnd: dto.periodEnd
  };
}
