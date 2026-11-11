
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { FirebaseAuthService } from '../../../../core/auth/services/firebase-auth.service';
import { NgZone } from '@angular/core';

import { ReservationService } from '../../../../features/reservations/services/reservation.service';
import { SessionService } from '../../../../core/auth/services/session.service';
import {
  VirtualQueueService,
  JoinQueuePayload
} from '../../../../features/services/components/services/virtual-queue.service';

interface OpenQueue {
  barbershopId: string;
  barbershopName: string;
  location: string;
  employeeId: string;
  employeeName: string;
}

interface QueueNotification {
  type: string;
  barbershop?: {
    id: string;
    name: string;
    location: string;
    employee?: {
      id: string;
      name: string;
    };
  };
}

@Component({
  selector: 'app-available-queues-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './available-queues-page.component.html',
  styleUrl: './available-queues-page.component.css'
})
export class AvailableQueuesPageComponent implements OnInit, OnDestroy {

  availableQueues: OpenQueue[] = [];
  connected = false;
  connectionError = false;

  // Formulario de ingreso a la cola
  selectedQueue: OpenQueue | null = null;
  serviciosDisponibles: any[] = [];
  selectedServicesIds: number[] = [];
  notes = 'Corte de cabello';

  loadingServicios = false;
  isJoiningQueue = false;
  queueError = '';
  queueSuccess = '';

  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(
    private readonly router: Router,
    private readonly reservationService: ReservationService,
    private readonly sessionService: SessionService,
    private readonly virtualQueueService: VirtualQueueService,
    private readonly firebaseAuthService: FirebaseAuthService,
    private readonly ngZone: NgZone
  ) { }

  ngOnInit(): void {
    console.log('AvailableQueuesPageComponent inicializado');
    this.connectToNotifications();
  }

  ngOnDestroy(): void {
    this.destroyed = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
  }

  private async connectToNotifications(): Promise<void> {
    if (this.destroyed) {
      return;
    }

    try {
      const token = await this.firebaseAuthService.getIdToken();

      if (this.destroyed) {
        return;
      }

      if (!token) {
        console.error(
          'No hay un usuario autenticado para conectar las notificaciones.'
        );
        this.connectionError = true;
        return;
      }

      const baseUrl = environment.apiUrl
        .replace(/^http:/, 'ws:')
        .replace(/^https:/, 'wss:')
        .replace(/\/$/, '');

      const wsUrl =
        `${baseUrl}/ws/notifications?token=${encodeURIComponent(token)}`;

      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.connected = true;
        this.connectionError = false;
        console.log('[WS notifications] Conexión establecida');
      };

      this.socket.onmessage = (event: MessageEvent) => {
        console.log('[WS notifications] Mensaje recibido:', event.data);

        try {
          const notification = JSON.parse(event.data) as QueueNotification;

          this.ngZone.run(() => {
            console.log('[WS notifications] Tipo:', notification.type);
            this.handleNotification(notification);
          });
        } catch (error) {
          console.error('Notificación de cola inválida:', error);
        }
      };

      this.socket.onerror = (event) => {
        console.error('Error en WebSocket de notificaciones:', event);
        this.connectionError = true;
      };

      this.socket.onclose = (event) => {
        this.connected = false;
        this.socket = null;

        console.log(
          '[WS notifications] Conexión cerrada:',
          event.code,
          event.reason
        );

        if (!this.destroyed) {
          this.reconnectTimer = setTimeout(
            () => void this.connectToNotifications(),
            3000
          );
        }
      };
    } catch (error) {
      console.error(
        'No fue posible conectar las notificaciones:',
        error
      );

      this.connectionError = true;

      if (!this.destroyed) {
        this.reconnectTimer = setTimeout(
          () => void this.connectToNotifications(),
          3000
        );
      }
    }
  }

  private handleNotification(notification: QueueNotification): void {
    const barbershop = notification.barbershop;
    const employee = barbershop?.employee;

    if (!barbershop?.id || !employee?.id) {
      console.warn(
        'Notificación sin información de barbería o empleado:',
        notification
      );
      return;
    }

    const queueKey = employee.id;

    switch (notification.type) {
      case 'QUEUE_OPENED': {
        const queue: OpenQueue = {
          barbershopId: barbershop.id,
          barbershopName: barbershop.name,
          location: barbershop.location,
          employeeId: employee.id,
          employeeName: employee.name
        };

        const index = this.availableQueues.findIndex(
          item => item.employeeId === queueKey
        );

        if (index >= 0) {
          this.availableQueues = this.availableQueues.map(item =>
            item.employeeId === queueKey ? queue : item
          );
        } else {
          this.availableQueues = [...this.availableQueues, queue];
        }

        break;
      }

      case 'QUEUE_CLOSED': {
        this.availableQueues = this.availableQueues.filter(
          item => item.employeeId !== queueKey
        );

        if (this.selectedQueue?.employeeId === queueKey) {
          this.cancelSelection();
        }

        break;
      }

      case 'QUEUE_ADD_CUSTOMER':
      case 'QUEUE_NEXT_CUSTOMER':
      case 'QUEUE_COMPLETED_CURRENT_TURN':
        // Estos eventos no cierran la cola.
        break;

      default:
        console.debug(
          'Evento de notificación no gestionado:',
          notification.type
        );
    }
  }

  // Abre el formulario y consulta los servicios de esa barbería.
  selectQueue(queue: OpenQueue): void {
    this.queueError = '';
    this.queueSuccess = '';

    if (this.selectedQueue?.employeeId === queue.employeeId) {
      this.cancelSelection();
      return;
    }

    this.selectedQueue = queue;
    this.serviciosDisponibles = [];
    this.selectedServicesIds = [];
    this.loadingServicios = true;

    this.reservationService
      .getServicesByBarberiaId(queue.barbershopId)
      .subscribe({
        next: (res: any) => {
          // Ignorar una respuesta si el usuario ya seleccionó otra cola.
          if (this.selectedQueue?.employeeId !== queue.employeeId) {
            return;
          }

          const rawList = res?.data ?? res;
          const list = Array.isArray(rawList)
            ? rawList
            : rawList
              ? [rawList]
              : [];

          this.serviciosDisponibles = list.filter((service: any) => {
            const id = Number(service.id ?? service.id_servicio);
            return Number.isInteger(id) && id > 0;
          });

          this.loadingServicios = false;
        },
        error: (err: any) => {
          console.error('Error al cargar servicios:', err);

          if (this.selectedQueue?.employeeId !== queue.employeeId) {
            return;
          }

          this.serviciosDisponibles = [];
          this.loadingServicios = false;
          this.queueError =
            'No fue posible cargar los servicios de esta barbería.';
        }
      });
  }

  getServiceId(service: any): number {
    return Number(service.id ?? service.id_servicio);
  }

  isServiceSelected(service: any): boolean {
    return this.selectedServicesIds.includes(this.getServiceId(service));
  }

  toggleServiceSelection(service: any): void {
    const id = this.getServiceId(service);

    if (!Number.isInteger(id) || id <= 0) {
      return;
    }

    if (this.selectedServicesIds.includes(id)) {
      this.selectedServicesIds = this.selectedServicesIds.filter(
        selectedId => selectedId !== id
      );
    } else {
      this.selectedServicesIds = [...this.selectedServicesIds, id];
    }

    this.queueError = '';
    this.queueSuccess = '';
  }

  cancelSelection(): void {
    this.selectedQueue = null;
    this.serviciosDisponibles = [];
    this.selectedServicesIds = [];
    this.notes = 'Corte de cabello';
    this.queueError = '';
    this.queueSuccess = '';
    this.loadingServicios = false;
  }

  joinSelectedQueue(): void {
    const queue = this.selectedQueue;

    if (!queue || this.isJoiningQueue) {
      return;
    }

    const customerId = this.sessionService.getClientId();

    if (!customerId) {
      this.queueError =
        'No se pudo obtener el identificador del cliente. Inicia sesión nuevamente.';
      return;
    }

    if (this.selectedServicesIds.length === 0) {
      this.queueError = 'Selecciona al menos un servicio.';
      return;
    }

    const payload: JoinQueuePayload = {
      customerId,
      barbershopId: queue.barbershopId,
      employeeId: queue.employeeId,
      reservationServiceId: [...this.selectedServicesIds],
      notes: this.notes.trim() || 'Cola virtual'
    };

    this.isJoiningQueue = true;
    this.queueError = '';
    this.queueSuccess = '';

    this.virtualQueueService.joinQueue(payload).subscribe({
      next: () => {
        this.isJoiningQueue = false;

        // Navegar solo después de que el POST haya respondido correctamente.
        void this.router.navigate(['/panel/virtual-queue-tracking']);
      },
      error: (err: any) => {
        this.isJoiningQueue = false;

        console.error(
          'Error al ingresar a la cola virtual:',
          err.status,
          err.error
        );

        this.queueError =
          err.error?.message ??
          err.error?.data?.message ??
          'No fue posible ingresar a la cola virtual. Inténtalo nuevamente.';
      }
    });
  }
}
