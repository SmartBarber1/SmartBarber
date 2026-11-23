
import {
  Component,
  OnDestroy,
  OnInit,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReservationService } from '../../../../reservations/services/reservation.service';
import { toApiError, toUserMessage } from '../../../../../core/errors';

import {
  VirtualQueueService,
  EmployeeQueueResponse,
  QueueSocketMessage,
  QueueTurn
} from '../virtual-queue.service';

type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

@Component({
  selector: 'app-virtual-queue-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './virtual-queue-page.component.html',
  styleUrl: './virtual-queue-page.component.css'
})
export class VirtualQueuePageComponent
  implements OnInit, OnDestroy {

  employeeId: string | null = null;

  queue: EmployeeQueueResponse | null = null;

  connectionStatus: ConnectionStatus = 'connecting';

  private connection: { close: () => void } | null = null;
  private destroyed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly RECONNECT_DELAY_MS = 3_000;

    /** Confirmación en la página para salir de la fila. */
  confirmingLeave = false;
  leaving = false;
  leaveError = '';
  /** El cliente salió de la fila en esta sesión. */
  left = false;

  constructor(
    private readonly virtualQueueService: VirtualQueueService,
    private readonly reservationService: ReservationService,
    private readonly ngZone: NgZone
  ) {}

  /** Turno del cliente (en espera o en atención). */
  get myTurn(): QueueTurn | null {
    if (this.queue?.currentTurn?.mine) {
      return this.queue.currentTurn;
    }
    return this.waitingTurns.find(turn => turn.mine) ?? null;
  }

  get myTurnInProgress(): boolean {
    return !!this.queue?.currentTurn?.mine;
  }

  /** Texto de la cantidad de turnos con el plural correcto. */
  turnsLabel(count: number): string {
    return `${count} ${count === 1 ? 'turno' : 'turnos'}`;
  }

  askLeave(): void {
    this.leaveError = '';
    this.confirmingLeave = true;
  }

  cancelLeave(): void {
    this.confirmingLeave = false;
  }

  /** Sale de la fila: cancela el turno y la cola se actualiza para todos. */
  leaveQueue(): void {
    const turn = this.myTurn;
    if (!turn || this.leaving || this.myTurnInProgress) return;

    this.leaving = true;
    this.leaveError = '';
    this.reservationService.cancelReservation(turn.reservationId).subscribe({
      next: () => {
        this.leaving = false;
        this.confirmingLeave = false;
        this.left = true;
        this.virtualQueueService.forgetEmployee();
      },
      error: (error: unknown) => {
        this.leaving = false;
        this.leaveError = toApiError(error).code === 'RES_009'
          ? 'Tu turno ya no está en la fila.'
          : toUserMessage(error, { DEFAULT: 'No fue posible salir de la fila. Inténtalo nuevamente.' });
      }
    });
  }

  get statusLabel(): string {
    switch (this.connectionStatus) {
      case 'connecting':
        return 'Conectando...';

      case 'connected':
        return 'Conectado en tiempo real';

      case 'disconnected':
        return 'Desconectado';

      case 'error':
        return 'Error de conexión';

      default:
        return 'Estado desconocido';
    }
  }

  get waitingTurns(): QueueTurn[] {
    return this.queue?.waitingTurns ?? [];
  }

  ngOnInit(): void {
    this.employeeId =
      this.virtualQueueService.getLastEmployeeId();

    if (this.employeeId) {
      this.connectToQueue();
      return;
    }

    // Pestaña nueva u otro dispositivo: el turno vigente se recupera del servidor.
    this.virtualQueueService.findActiveTurn().subscribe(active => {
      if (this.destroyed) return;
      if (!active) {
        this.connectionStatus = 'disconnected';
        return;
      }
      this.employeeId = active.employeeId;
      this.virtualQueueService.rememberEmployee(active.employeeId);
      this.connectToQueue();
    });
  }

  private connectToQueue(): void {
    if (!this.employeeId) {
      return;
    }

    this.connectionStatus = 'connecting';

    this.connection =
      this.virtualQueueService.connectToQueue(
        this.employeeId,

        (message: QueueSocketMessage) => {
          this.ngZone.run(() => {
            this.queue = message.payload;
            this.connectionStatus = 'connected';
          });
        },

        () => {
          this.ngZone.run(() => {
            if (!this.destroyed) {
              this.connectionStatus = 'error';
              this.scheduleReconnect();
            }
          });
        },

        () => {
          this.ngZone.run(() => {
            if (!this.destroyed) {
              this.connectionStatus = 'disconnected';
              this.scheduleReconnect();
            }
          });
        }
      );
  }

  /**
   * El servidor o un proxy pueden cerrar el WebSocket (inactividad, redeploy):
   * se reconecta solo y el servidor reenvía la foto actual de la cola.
   */
  private scheduleReconnect(): void {
    if (this.destroyed || this.reconnectTimer || this.left) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.destroyed) return;
      this.connection?.close();
      this.connectToQueue();
    }, VirtualQueuePageComponent.RECONNECT_DELAY_MS);
  }

  trackByReservation(
    index: number,
    turn: QueueTurn
  ): string {
    return turn.reservationId;
  }

  getTurnStatus(status: string): string {
    switch (status) {
      case 'WAITING':
        return 'En espera';

      case 'IN_PROGRESS':
        return 'En atención';

      case 'COMPLETED':
        return 'Finalizado';

      case 'CANCELLED':
        return 'Cancelado';

      default:
        return status;
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.connection?.close();
    this.connection = null;
  }
}
