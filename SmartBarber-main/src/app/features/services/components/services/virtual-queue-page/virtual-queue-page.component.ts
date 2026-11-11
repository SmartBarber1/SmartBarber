
import {
  Component,
  OnDestroy,
  OnInit,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';

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

  constructor(
    private readonly virtualQueueService: VirtualQueueService,
    private readonly ngZone: NgZone
  ) {}

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

    if (!this.employeeId) {
      this.connectionStatus = 'disconnected';
      return;
    }

    this.connectToQueue();
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
            }
          });
        },

        () => {
          this.ngZone.run(() => {
            if (!this.destroyed) {
              this.connectionStatus = 'disconnected';
            }
          });
        }
      );
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
    this.connection?.close();
    this.connection = null;
  }
}
