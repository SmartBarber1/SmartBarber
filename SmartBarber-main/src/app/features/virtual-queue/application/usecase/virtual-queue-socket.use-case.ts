import { Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { QueueEvent } from '../../domain/model/queue-event.model';
import { EventQueueRepository } from '../../domain/repository/event-queue.repository';

@Injectable({
  providedIn: 'root'
})
export class VirtualQueueWebSocketUseCase extends EventQueueRepository {

  private socket$?: Observable<QueueEvent>;
  private socket?: WebSocket;

  override connectWebsocket(
    employeeId: string
  ): Observable<QueueEvent> {

    if (this.socket$) {
      return this.socket$;
    }

    this.socket$ = new Observable<QueueEvent>(observer => {
      console.log('Entree WS: ', environment.apiUrl)

      const wsUrl = environment.apiUrl
        .replace(/^http:/, 'ws:')
        .replace(/^https:/, 'wss:')
        .replace(/\/$/, '');
      
      console.log('Entree WS: ', wsUrl)

      this.socket = new WebSocket(
        `${wsUrl}/ws/virtual-queue?employeeId=${encodeURIComponent(employeeId)}`
      );

      this.socket.onopen = () => {
        console.log(
          '[VirtualQueueWS] Conectado para empleado:',
          employeeId
        );
      };

      this.socket.onmessage = event => {

        try {

          const response = JSON.parse(
            event.data
          ) as QueueEvent;

          if (!response?.type) {
            return;
          }

          observer.next(response);

        } catch (error) {

          console.error(
            '[VirtualQueueWS] Error procesando mensaje',
            error
          );
        }
      };

      this.socket.onerror = error => {

        console.error(
          '[VirtualQueueWS] Error de conexión',
          error
        );

        observer.error(error);
      };

      this.socket.onclose = event => {

        console.log(
          '[VirtualQueueWS] Conexión cerrada',
          event.code,
          event.reason
        );

        this.socket = undefined;
        this.socket$ = undefined;

        observer.complete();
      };

      return () => {

        if (
          this.socket &&
          (
            this.socket.readyState === WebSocket.OPEN ||
            this.socket.readyState === WebSocket.CONNECTING
          )
        ) {
          this.socket.close();
        }

        this.socket = undefined;
        this.socket$ = undefined;
      };
    }).pipe(
      shareReplay(1)
    );

    return this.socket$;
  }

  disconnect(): void {

    if (
      this.socket &&
      (
        this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING
      )
    ) {
      this.socket.close();
    }

    this.socket = undefined;
    this.socket$ = undefined;
  }
}