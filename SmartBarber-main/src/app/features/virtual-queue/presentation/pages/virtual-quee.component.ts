import {
  Component,
  OnInit,
  OnDestroy,
  computed,
  inject,
  signal
} from '@angular/core';

import { Subscription } from 'rxjs';

import { CommonModule } from '@angular/common';

import { OpenQueueUseCase } from '../../application/usecase/open-queue.use-case';
import { CloseQueueUseCase } from '../../application/usecase/close-queue.use-case';
import { GetQueueUseCase } from '../../application/usecase/get-queue.use-case';
import { NextCustomerUseCase } from '../../application/usecase/next-customer.use-case';
import { GetStatusQueueUseCase } from '../../application/usecase/get-status-queue.use-case';
import { CompleteCurrentTurnUseCase } from '../../application/usecase/complete-current-turn.use-case';
import { VirtualQueueWebSocketUseCase } from '../../application/usecase/virtual-queue-socket.use-case';
import { ActivatedRoute } from '@angular/router';

import { SessionService } from '../../../../core/auth/services/session.service';

import {
  QueueSnapshotResponse,
  //QueueReservation,
  QueueStatus,
  QueueErrorResponse,
} from '../../domain/model/reservation-queue.model';
import { QueueSnapshotResponseEvent, QueueTurn } from '../../domain/model/queue-event.model';
import { HttpErrorResponse } from '@angular/common/http';

import { QueueSummaryCardComponent } from '../components/queue-summary-card/queue-summary-card.component';
import { QueueHeaderComponent } from '../components/queue-header/queue-header.component';
import { CurrentTurnCardComponent } from '../components/current-turn-card/current-turn-card.component';
import { QueueActionsComponent } from '../components/queue-actions/queue-actions.component';
import { WaitingTurnsTableComponent } from '../components/waiting-turns-table/waiting-turns-table.component';
import { QueueStatusCardComponent } from '../components/queue-status-card/queue-status-card.component';

@Component({
  selector: 'app-virtual-queue',
  standalone: true,
  imports: [CommonModule,
    QueueHeaderComponent,
    QueueSummaryCardComponent,
    CurrentTurnCardComponent,
    QueueActionsComponent,
    WaitingTurnsTableComponent,
    QueueStatusCardComponent
  ],
  templateUrl: './virtual-queue.component.html',
  styleUrl: './virtual-queue.component.css'
})
export class VirtualQueueComponent implements OnInit, OnDestroy {
  ngOnDestroy(): void {

    this.websocketSubscription?.unsubscribe();
    this.websocketEvents.disconnect();
  }

  private websocketSubscription?: Subscription;

  private readonly session =
    inject(SessionService);

  private readonly route =
    inject(ActivatedRoute);

  private readonly openQueueUseCase =
    inject(OpenQueueUseCase);

  private readonly closeQueueUseCase =
    inject(CloseQueueUseCase);

  private readonly getQueueUseCase =
    inject(GetQueueUseCase);

  private readonly nextCustomerUseCase =
    inject(NextCustomerUseCase);

  private readonly completeCurrentTurnUseCase =
    inject(CompleteCurrentTurnUseCase);

  private readonly getStatusQueue =
    inject(GetStatusQueueUseCase);

  private readonly websocketEvents =
    inject(VirtualQueueWebSocketUseCase);

  readonly loading =
    signal(false);

  readonly actionLoading =
    signal(false);

  readonly errorMessage =
    signal('');

  readonly snapshot =
    signal<QueueSnapshotResponse | QueueSnapshotResponseEvent | null>(null);

  readonly currentTurn =
    signal</*QueueReservation | */QueueTurn | null>(null);

  readonly waitingTurns =
    signal</*QueueReservation | QueueReservation []*/ QueueTurn[]>([]);

  readonly acceptingClients =
    signal(false);

  readonly waitingCount =
    signal(0);

  readonly queueClosed = computed(
    () => !!this.snapshot() && !this.acceptingClients()
  );

  private get employeeId(): string {

    const employeeIdFromUrl =
      this.route.snapshot.queryParamMap.get('employeeId');

    if (employeeIdFromUrl) {
      return employeeIdFromUrl;
    }

    const barberId =
      this.session.getBarberId();

    if (barberId) {
      return barberId;
    }

    throw new Error(
      'No se encontró el identificador del empleado.'
    );
  }

  ngOnInit(): void {
    this.consultStatusQueue();
  }

  loadQueue(): void {

    this.loading.set(true);
    this.errorMessage.set('');

    this.getQueueUseCase
      .execute(this.employeeId)
      .subscribe({

        next: response => {

          this.snapshot.set(response);

          this.acceptingClients.set(
            response.acceptingClients
          );

          this.currentTurn.set(
            response.currentTurn
          );

          this.waitingTurns.set(
            response.waitingTurns
          );

          this.waitingCount.set(
            response.waitingTurns.length
          );

          this.loading.set(false);
        },

        error: error => {

          console.error(
            'Error consultando cola',
            error
          );

          this.errorMessage.set(
            'No fue posible consultar la cola.'
          );

          this.loading.set(false);
        }
      });
  }

  consultStatusQueue(): void {
    this.loading.set(true)

    this.getStatusQueue.execute(this.employeeId)
      .subscribe({
        next: response => {
          this.loading.set(false),
            this.acceptingClients.set(response.acceptingClients)
          if (response.acceptingClients) {
            this.loadQueue();
            this.connectWebsocketEvent()
          }
        },
        error: (error: HttpErrorResponse) => {

          this.loading.set(false);
          this.acceptingClients.set(false)
          const response: QueueErrorResponse =
            error.error;

          console.error(
            'Error en el proceso de consulta de cola',
            response
          );

          this.errorMessage.set(
            response.message
          );
        }
      });

  }

  openQueue(): void {

    this.actionLoading.set(true);

    this.openQueueUseCase
      .execute(this.employeeId)
      .subscribe({
        next: () => {

          this.actionLoading.set(false);
          this.loadQueue();
          this.connectWebsocketEvent()
        },
        error: (error: HttpErrorResponse) => {

          this.loading.set(false);
          this.acceptingClients.set(false)
          const response: QueueErrorResponse =
            error.error;

          console.error(
            'Error en el proceso de consulta de cola',
            response
          );

          this.errorMessage.set(
            response.message
          );
        }
      });
  }

  closeQueue(): void {

    this.actionLoading.set(true);

    this.closeQueueUseCase
      .execute(this.employeeId)
      .subscribe({

        next: () => {
          this.actionLoading.set(false);
          this.consultStatusQueue();
        },

        error: (error: HttpErrorResponse) => {

          this.loading.set(false);
          this.acceptingClients.set(false)
          const response: QueueErrorResponse =
            error.error;

          console.error(
            'Error en el proceso de consulta de cola',
            response
          );

          this.errorMessage.set(
            response.message
          );
        }
      });
  }

  nextCustomer(): void {

    this.actionLoading.set(true);

    this.nextCustomerUseCase
      .execute(this.employeeId)
      .subscribe({

        next: () => {

          this.actionLoading.set(false);
          //this.loadQueue();
        },

        error: error => {

          console.error(
            'Error llamando siguiente turno',
            error
          );

          this.actionLoading.set(false);
        }
      });
  }

  completeTurn(): void {

    this.actionLoading.set(true);

    this.completeCurrentTurnUseCase
      .execute(this.employeeId)
      .subscribe({

        next: () => {

          this.actionLoading.set(false);
          this.loadQueue();
        },

        error: (error: HttpErrorResponse) => {

          this.loading.set(false);
          this.acceptingClients.set(false)
          const response: QueueErrorResponse =
            error.error;

          console.error(
            'Error en el proceso de consulta de cola',
            response
          );

          this.errorMessage.set(
            response.message
          );
        }
      });
  }

  connectWebsocketEvent(): void {
    console.log('Entree WS')
    console.log('CONECTANDO SOCKET');

    if (this.websocketSubscription) {
      console.log('SOCKET YA EXISTE');
      return;
    }


    this.websocketSubscription =
      this.websocketEvents
        .connectWebsocket(this.employeeId)
        .subscribe({

          next: event => {
            console.log(
              'EVENTO RECIBIDO DEL WS',
              event
            );

            console.log(
              '[QUEUE EVENT]',
              event.type,
              event
            );

            switch (event.type) {

              case 'QUEUE_SNAPSHOT':
              case 'QUEUE_NEXT_CUSTOMER':
              case 'QUEUE_ADD_CUSTOMER':
              case 'QUEUE_COMPLETED_CURRENT_TURN':

                this.updateSnapshot(event.payload);
                break;

              default:

                console.warn(
                  'Evento no manejado:',
                  event.type
                );
            }
          },

          error: error => {

            console.error(
              'Error WebSocket:',
              error
            );

            this.websocketSubscription = undefined;
          },

          complete: () => {

            this.websocketSubscription = undefined;
          }
        });
  }

  private updateSnapshot(
    payload: QueueSnapshotResponseEvent
  ): void {

    this.snapshot.set(payload);

    this.acceptingClients.set(
      payload.acceptingClients
    );

    this.currentTurn.set(
      payload.currentTurn
    );

    this.waitingTurns.set(
      payload.waitingTurns
    );

    this.waitingCount.set(
      payload.waitingTurns.length
    );
  }
}