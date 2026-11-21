import { HttpErrorResponse } from '@angular/common/http';
import {
  ComponentFixture,
  TestBed
} from '@angular/core/testing';

import {
  of,
  throwError
} from 'rxjs';

import {
  PaymentHistoryComponent
} from './payment-history.component';

import {
  GetPaymentHistoryUseCase
} from '../../application/use-cases/get-payment-history.use-case';

import {
  PaymentHistoryFilters
} from '../../domain/models/payment-history.model';


const createHistory = (
  page: number,
  totalPages: number,
  totalElements = 2
) => ({

  content: [

    {

      id: 'pay-001',

      date:
        '2026-09-01T15:00:00Z',

      status:
        'PAID' as const,

      amount:
        60000,

      currency:
        'COP',

      transactionReference:
        'TX-001',

      description:
        'Suscripción mensual'

    },

    {

      id: 'pay-002',

      date:
        '2026-08-01T15:00:00Z',

      status:
        'PENDING' as const,

      amount:
        60000,

      currency:
        'COP',

      transactionReference:
        'TX-002',

      description:
        'Suscripción mensual'

    }

  ],

  page,

  size: 10,

  totalElements,

  totalPages

});


describe(
  'PaymentHistoryComponent',
  () => {

    let component:
      PaymentHistoryComponent;

    let fixture:
      ComponentFixture<PaymentHistoryComponent>;

    let executeSpy:
      jasmine.Spy;


    beforeEach(
      async () => {

        executeSpy =
          jasmine
            .createSpy('execute')
            .and
            .returnValue(
              of(
                createHistory(
                  0,
                  2
                )
              )
            );


        await TestBed
          .configureTestingModule({

            imports: [
              PaymentHistoryComponent
            ],

            providers: [

              {

                provide:
                  GetPaymentHistoryUseCase,

                useValue: {

                  execute:
                    executeSpy

                }

              }

            ]

          })
          .compileComponents();


        fixture =
          TestBed.createComponent(
            PaymentHistoryComponent
          );

        component =
          fixture.componentInstance;

        fixture.detectChanges();

      }
    );


    it(
      'should create',
      () => {

        expect(
          component
        )
          .toBeTruthy();

      }
    );


    it(
      'should load the first page',
      () => {

        expect(
          executeSpy
        )
          .toHaveBeenCalledWith({

            page: 0,

            size: 10

          });


        expect(
          component.currentPage()
        )
          .toBe(0);


        expect(
          component.totalPages()
        )
          .toBe(2);


        expect(
          component.payments().length
        )
          .toBe(2);

      }
    );


    it(
      'should apply status and date filters and reset to the first page',
      () => {

        component.onStatusChange(
          'PAID'
        );

        component.onFromDateChange(
          '2026-09-01'
        );

        component.onToDateChange(
          '2026-09-13'
        );

        component.applyFilters();


        const filters =
          executeSpy
            .calls
            .mostRecent()
            .args[0] as PaymentHistoryFilters;


        expect(filters)
          .toEqual({

            page: 0,

            size: 10,

            status: 'PAID',

            fromDate:
              '2026-09-01',

            toDate:
              '2026-09-13'

          });

      }
    );


    it(
      'should reject an invalid date range',
      () => {

        executeSpy.calls.reset();


        component.onFromDateChange(
          '2026-09-14'
        );

        component.onToDateChange(
          '2026-09-13'
        );


        component.applyFilters();


        expect(
          executeSpy
        )
          .not
          .toHaveBeenCalled();


        expect(
          component.errorMessage()
        )
          .toBe(
            'La fecha inicial no puede ser posterior a la fecha final.'
          );

      }
    );


    it(
      'should clear filters and reload the first page',
      () => {

        component.onStatusChange(
          'PAID'
        );

        component.onFromDateChange(
          '2026-09-01'
        );

        component.onToDateChange(
          '2026-09-13'
        );


        executeSpy.calls.reset();


        component.clearFilters();


        expect(
          component.selectedStatus()
        )
          .toBe('');


        expect(
          component.fromDate()
        )
          .toBe('');


        expect(
          component.toDate()
        )
          .toBe('');


        expect(
          executeSpy
        )
          .toHaveBeenCalledWith({

            page: 0,

            size: 10

          });

      }
    );


    it(
      'should request the next page',
      () => {

        executeSpy.calls.reset();


        executeSpy.and.returnValue(
          of(
            createHistory(
              1,
              2
            )
          )
        );


        component.nextPage();


        expect(
          executeSpy
        )
          .toHaveBeenCalledWith({

            page: 1,

            size: 10

          });


        expect(
          component.currentPage()
        )
          .toBe(1);

      }
    );


    it(
      'should request the previous page',
      () => {

        executeSpy.and.returnValue(
          of(
            createHistory(
              1,
              2
            )
          )
        );


        component.changePage(1);


        executeSpy.calls.reset();


        executeSpy.and.returnValue(
          of(
            createHistory(
              0,
              2
            )
          )
        );


        component.previousPage();


        expect(
          executeSpy
        )
          .toHaveBeenCalledWith({

            page: 0,

            size: 10

          });


        expect(
          component.currentPage()
        )
          .toBe(0);

      }
    );


    it(
      'should not request a page outside the available range',
      () => {

        executeSpy.calls.reset();


        component.changePage(-1);

        component.changePage(2);


        expect(
          executeSpy
        )
          .not
          .toHaveBeenCalled();

      }
    );


    it(
      'should show an error when the history cannot be loaded',
      () => {

        executeSpy.calls.reset();


        executeSpy.and.returnValue(
          throwError(
            () => new HttpErrorResponse({
              status: 400,
              error: { code: 'SB_008', message: 'forbidden' }
            })
          )
        );


        component.nextPage();


        expect(
          component.loading()
        )
          .toBeFalse();


        expect(
          component.errorMessage()
        )
          .toBe(
            'Solo el administrador de la barbería puede consultar su historial de pagos.'
          );

      }
    );


    it(
      'should expose payment status labels',
      () => {

        expect(
          component.getStatusLabel(
            'PAID'
          )
        )
          .toBe('Pagado');


        expect(
          component.getStatusLabel(
            'PENDING'
          )
        )
          .toBe('Pendiente');

      }
    );

  }
);