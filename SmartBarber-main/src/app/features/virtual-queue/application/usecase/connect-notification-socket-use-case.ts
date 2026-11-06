import { Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';

import { environment } from '../../../../../environments/environment';

import { NotificationRepository }
  from '../../domain/repository/notification.repository';

import { NotificationEvent }
  from '../../domain/model/notification-event.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationWebSocketUseCase
  extends NotificationRepository {

  private socket?: WebSocket;

  private socket$?: Observable<NotificationEvent>;

  override connect(): Observable<NotificationEvent> {

    if (this.socket$) {
      return this.socket$;
    }

    this.socket$ =
      new Observable<NotificationEvent>(observer => {

        const wsUrl = environment.apiUrl
          .replace(/^http:/, 'ws:')
          .replace(/^https:/, 'wss:')
          .replace(/\/$/, '');

        this.socket =
          new WebSocket(
            `${wsUrl}/ws/notification`
          );

        this.socket.onopen = () => {

          console.log(
            '[NotificationWS] Conectado'
          );
        };

        this.socket.onmessage = event => {

          try {

            const response =
              JSON.parse(
                event.data
              ) as NotificationEvent;

            if (!response?.type) {
              return;
            }

            observer.next(response);

          } catch (error) {

            console.error(
              '[NotificationWS] Error procesando mensaje',
              error
            );
          }
        };

        this.socket.onerror = error => {

          console.error(
            '[NotificationWS] Error',
            error
          );

          observer.error(error);
        };

        this.socket.onclose = event => {

          console.log(
            '[NotificationWS] Cerrado',
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

  override disconnect(): void {

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