import {
  Component,
  OnInit,
  OnDestroy,
  computed,
  inject,
  signal
} from '@angular/core';

import { Observable, Subscription } from 'rxjs';

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
import { toApiError, toUserMessage } from '../../../../core/errors';

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
    this.destroyed = true;
    this.stopPolling();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.websocketSubscription?.unsubscribe();
    this.websocketEvents.disconnect();
  }

  private websocketSubscription?: Subscription;
  private destroyed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly RECONNECT_DELAY_MS = 3_000;
  /**
   * Respaldo del tiempo real: mientras la cola está abierta se relee cada
   * cierto tiempo, por si el WebSocket no llega a conectar (red, proxy) o se
   * pierde un evento. No muestra indicador de carga.
   */
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private static readonly POLL_INTERVAL_MS = 10_000;

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

  /**
   * Carga la cola con una sola consulta: el barbero recibe la cola completa,
   * también cerrada. Si nunca se ha creado, el servidor responde BQ_001.
   */
  loadQueue(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.getQueueUseCase
      .execute(this.employeeId)
      .subscribe({
        next: response => {
          this.applySnapshot(response);
          this.loading.set(false);
          if (response.acceptingClients) {
            this.connectWebsocketEvent();
          }
        },
        error: (error: unknown) => {
          this.loading.set(false);
          if (toApiError(error).code === 'BQ_001') {
            // Sin cola creada: la plantilla ofrece "Iniciar cola virtual".
            this.snapshot.set(null);
            return;
          }
          this.errorMessage.set(toUserMessage(error, { DEFAULT: 'No fue posible consultar la cola.' }));
        }
      });
  }

  /** Botón "Actualizar" y carga inicial. */
  consultStatusQueue(): void {
    this.loadQueue();
  }

  openQueue(): void {
    this.runAction(this.openQueueUseCase.execute(this.employeeId), 'No fue posible abrir la cola.');
  }

  closeQueue(): void {
    this.runAction(this.closeQueueUseCase.execute(this.employeeId), 'No fue posible cerrar la cola.');
  }

  /** Llama al siguiente y muestra de inmediato el turno en atención. */
  nextCustomer(): void {
    this.runAction(this.nextCustomerUseCase.execute(this.employeeId), 'No fue posible llamar al siguiente cliente.');
  }

  completeTurn(): void {
    this.runAction(this.completeCurrentTurnUseCase.execute(this.employeeId), 'No fue posible finalizar el turno.');
  }

  /** Ejecuta una acción de la cola y, al terminar, vuelve a leer su estado. */
  private runAction(action: Observable<unknown>, fallback: string): void {
    if (this.actionLoading()) return;

    this.actionLoading.set(true);
    this.errorMessage.set('');

    action.subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.loadQueue();
      },
      error: (error: unknown) => {
        this.actionLoading.set(false);
        this.errorMessage.set(toUserMessage(error, { DEFAULT: fallback }));
        // El estado pudo cambiar (por ejemplo, otro dispositivo llamó al siguiente).
        this.loadQueue();
      }
    });
  }

  /**
   * Escucha la cola en tiempo real: cuando un cliente se une, sale o cambia
   * su turno, el servidor avisa y la cola se relee sin pulsar "Actualizar".
   * Si el socket se cierra (inactividad del proxy, redeploy), se reconecta.
   */
  connectWebsocketEvent(): void {
    if (this.websocketSubscription || this.destroyed) {
      return;
    }

    this.websocketSubscription = this.websocketEvents
      .connectWebsocket(this.employeeId)
      .subscribe({
        next: event => {
          if (event.type === 'QUEUE_SNAPSHOT') {
            // Foto inicial (y tras cada reconexión): se relee por REST, donde
            // el barbero recibe la cola completa con los datos de sus clientes.
            this.refreshSilently();
            return;
          }
          // QUEUE_ADD_CUSTOMER, QUEUE_CUSTOMER_LEFT, QUEUE_NEXT_CUSTOMER,
          // QUEUE_COMPLETED_CURRENT_TURN, QUEUE_OPENED, QUEUE_CLOSED...
          this.refreshSilently();
        },
        error: error => {
          console.error('[VirtualQueueWS] Conexión fallida:', error);
          this.websocketSubscription = undefined;
          this.scheduleReconnect();
        },
        complete: () => {
          this.websocketSubscription = undefined;
          this.scheduleReconnect();
        }
      });
  }

  private scheduleReconnect(): void {
    if (this.destroyed || this.reconnectTimer || !this.acceptingClients()) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.destroyed && this.acceptingClients()) {
        this.connectWebsocketEvent();
      }
    }, VirtualQueueComponent.RECONNECT_DELAY_MS);
  }

    /** Relee la cola sin mostrar el indicador de carga (eventos en tiempo real). */
  private refreshSilently(): void {
    this.getQueueUseCase.execute(this.employeeId).subscribe({
      next: response => this.applySnapshot(response),
      error: () => undefined
    });
  }

  private applySnapshot(
    payload: QueueSnapshotResponseEvent
  ): void {
    this.updateSnapshot(payload);
    if (payload.acceptingClients) {
      this.startPolling();
    } else {
      this.stopPolling();
    }
  }

  private startPolling(): void {
    if (this.pollTimer || this.destroyed) return;
    this.pollTimer = setInterval(() => {
      // Pestaña oculta: no se consulta; al volver se actualiza en el siguiente ciclo.
      if (typeof document !== 'undefined' && document.hidden) return;
      if (!this.actionLoading()) this.refreshSilently();
    }, VirtualQueueComponent.POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
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