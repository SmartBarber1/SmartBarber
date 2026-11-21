import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PaymentApiService } from './payment-api.service';

describe('PaymentApiService', () => {
  let service: PaymentApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PaymentApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(PaymentApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('envía los filtros con el estado del back y traduce la respuesta', () => {
    let result: any;
    service.getPaymentHistory({ page: 0, size: 10, status: 'PAID', fromDate: '2026-01-01' })
      .subscribe(history => (result = history));

    const req = http.expectOne(r => r.url.endsWith('/subscription-barbershop-service/payment-history'));
    expect(req.request.params.get('status')).toBe('APPROVED');
    expect(req.request.params.get('fromDate')).toBe('2026-01-01');
    expect(req.request.params.has('toDate')).toBeFalse();

    req.flush({
      content: [{
        transactionId: 't-1', orderId: 'o-1', subscriptionBarberId: 's-1', planName: 'Plan Premium',
        amount: 30000, discount: 0, subtotal: 30000, status: 'APPROVED',
        createdAt: '2026-01-10T15:00:00Z', updatedAt: null, periodStart: null, periodEnd: null
      }],
      page: 0, size: 10, totalElements: 1, totalPages: 1
    });

    expect(result.content[0].status).toBe('PAID');
    expect(result.content[0].transactionReference).toBe('o-1');
    expect(result.content[0].description).toBe('Plan Premium');
  });
});
