
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../../src/environments/environment';
import { getAuth } from 'firebase/auth';

export interface JoinQueuePayload {
  customerId: string;
  barbershopId: string;
  employeeId: string;
  reservationServiceId: number[];
  notes: string;
}

export interface QueueTurn {
  reservationId: string;
  customer: {
    id: string;
    name: string;
    cell: string;
  } | null;
  position: number;
  estimatedWaitMinutes: number;
  durationMinutes: number;
  status: string;
}

export interface EmployeeQueueResponse {
  employeeId: string;
  acceptingClients: boolean;
  currentTurn: QueueTurn | null;
  waitingTurns: QueueTurn[];
  updatedAt: string;
}

export interface QueueSocketMessage {
  type: 'QUEUE_UPDATED' | 'QUEUE_SNAPSHOT' | string;
  payload: EmployeeQueueResponse;
}

@Injectable({
  providedIn: 'root'
})
export class VirtualQueueService {
  private readonly apiUrl = `${environment.apiUrl}/api/v1/queue`;

  private readonly employeeStorageKey = 'smartbarber.virtualQueue.employeeId';

  constructor(private readonly http: HttpClient) { }

  joinQueue(payload: JoinQueuePayload): Observable<unknown> {
    return new Observable(observer => {
      const subscription = this.http
        .post(`${this.apiUrl}/join`, payload)
        .subscribe({
          next: response => {
            // Recordamos qué cola acaba de seleccionar el cliente.
            try {
              sessionStorage.setItem(
                this.employeeStorageKey,
                payload.employeeId
              );
            } catch {
              // La aplicación puede continuar aunque no haya almacenamiento.
            }

            observer.next(response);
            observer.complete();
          },
          error: error => observer.error(error)
        });

      return () => subscription.unsubscribe();
    });
  }

  getLastEmployeeId(): string | null {
    try {
      return sessionStorage.getItem(this.employeeStorageKey);
    } catch {
      return null;
    }
  }

  connectToQueue(
    employeeId: string,
    onMessage: (message: QueueSocketMessage) => void,
    onError: () => void,
    onClose: () => void
  ): { close: () => void } {
    const user = getAuth().currentUser;

    if (!user) {
      onError();
      return { close: () => { } };
    }

    let socket: WebSocket | null = null;
    let cancelled = false;

    void user.getIdToken().then(token => {
      if (cancelled) return;

      const baseUrl = environment.apiUrl
        .replace(/^http:/, 'ws:')
        .replace(/^https:/, 'wss:')
        .replace(/\/$/, '');

      const url =
        `${baseUrl}/ws/virtual-queue` +
        `?employeeId=${encodeURIComponent(employeeId)}` +
        `&token=${encodeURIComponent(token)}`;

      socket = new WebSocket(url);

      socket.onopen = () => {
        console.log('[CLIENTE WS] Conectado:', employeeId);
      };

      socket.onmessage = event => {
        try {
          const message = JSON.parse(event.data);

          console.log('[CLIENTE WS] Evento recibido:', message);

          const eventsToRefresh = [
            'QUEUE_NEXT_CUSTOMER',
            'QUEUE_COMPLETED_CURRENT_TURN',
            'QUEUE_UPDATED'
          ];

          if (message.type === 'QUEUE_SNAPSHOT' && message.payload) {
            onMessage({
              type: 'QUEUE_SNAPSHOT',
              payload: message.payload
            });
            return;
          }

          if (eventsToRefresh.includes(message.type)) {
            console.log('[CLIENTE WS] Actualizando información de la cola...');

            this.http
              .get<EmployeeQueueResponse>(`${this.apiUrl}/${employeeId}`)
              .subscribe({
                next: queue => {
                  if (!cancelled) {
                    console.log(
                      '[CLIENTE WS] Cola actualizada:',
                      queue.waitingTurns.length
                    );

                    onMessage({
                      type: 'QUEUE_UPDATED',
                      payload: queue
                    });
                  }
                },
                error: error => {
                  console.error(
                    '[CLIENTE WS] Error consultando la cola:',
                    error
                  );
                }
              });
          }

        } catch (error) {
          console.error(
            '[CLIENTE WS] Error procesando mensaje:',
            error
          );
        }
      };

      socket.onerror = error => {
        console.error('[CLIENTE WS] Error:', error);
        if (!cancelled) onError();
      };

      socket.onclose = event => {
        console.log('[CLIENTE WS] Conexión cerrada:', event.code);

        if (!cancelled) onClose();
      };

    }).catch(error => {
      console.error('[CLIENTE WS] Error obteniendo token:', error);
      if (!cancelled) onError();
    });

    return {
      close: () => {
        cancelled = true;

        if (socket) {
          socket.onmessage = null;
          socket.onerror = null;
          socket.onclose = null;
          socket.close();
          socket = null;
        }
      }
    };
  }
}
