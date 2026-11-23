import { Injectable, inject } from '@angular/core';
import { Observable, share } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { FirebaseAuthService } from '../../../../core/auth/services/firebase-auth.service';
import { QueueEvent } from '../../domain/model/queue-event.model';
import { EventQueueRepository } from '../../domain/repository/event-queue.repository';

/**
 * WebSocket de la cola del barbero (/ws/virtual-queue).
 *
 * El servidor exige sesión en esta ruta, así que se envía el token de Firebase
 * como parámetro (igual que el cliente). Sin token el servidor rechaza la
 * conexión y el barbero no recibe los eventos en tiempo real.
 *
 * El observable termina (complete/error) cuando el socket se cierra; quien lo
 * usa decide reconectar.
 */
@Injectable({
  providedIn: 'root'
})
export class VirtualQueueWebSocketUseCase extends EventQueueRepository {

  private readonly firebaseAuth = inject(FirebaseAuthService);

  private socket$?: Observable<QueueEvent>;
  private socket?: WebSocket;

  override connectWebsocket(employeeId: string): Observable<QueueEvent> {
    if (this.socket$) {
      return this.socket$;
    }

    this.socket$ = new Observable<QueueEvent>(observer => {
      let cancelled = false;

      void this.firebaseAuth.getIdToken().then(token => {
        if (cancelled) return;

        if (!token) {
          observer.error(new Error('Sin sesión para conectar la cola en tiempo real.'));
          return;
        }

        const baseUrl = environment.apiUrl
          .replace(/^http:/, 'ws:')
          .replace(/^https:/, 'wss:')
          .replace(/\/$/, '');

        const socket = new WebSocket(
          `${baseUrl}/ws/virtual-queue` +
          `?employeeId=${encodeURIComponent(employeeId)}` +
          `&token=${encodeURIComponent(token)}`
        );
        this.socket = socket;

        socket.onmessage = event => {
          try {
            const response = JSON.parse(event.data) as QueueEvent;
            if (response?.type) {
              observer.next(response);
            }
          } catch (error) {
            console.error('[VirtualQueueWS] Mensaje inválido', error);
          }
        };

        socket.onerror = () => {
          // El cierre llega después en onclose; ahí se notifica el fin.
        };

        socket.onclose = () => {
          this.reset(socket);
          observer.complete();
        };
      }).catch(error => {
        if (!cancelled) observer.error(error);
      });

      return () => {
        cancelled = true;
        const socket = this.socket;
        if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
          socket.onclose = null;
          socket.close();
        }
        this.reset(socket);
      };
    }).pipe(share());

    return this.socket$;
  }

  disconnect(): void {
    const socket = this.socket;
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      socket.onclose = null;
      socket.close();
    }
    this.reset(socket);
  }

  private reset(socket: WebSocket | undefined): void {
    if (this.socket === socket) {
      this.socket = undefined;
    }
    this.socket$ = undefined;
  }
}
