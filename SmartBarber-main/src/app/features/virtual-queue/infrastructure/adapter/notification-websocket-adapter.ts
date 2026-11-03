import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { NotificationRepository } from '../../domain/repository/notification.repository';
import { NotificationEvent } from '../../domain/model/queue-event.model';

import { WebSocketFactory } from '../common/websocket-factory';

@Injectable()
export class NotificationWebSocketAdapter
  extends NotificationRepository {
  constructor(
    private readonly webSocketFactory: WebSocketFactory
  ) {
    super();
  }

  override connect(
    userId: string
  ): Observable<NotificationEvent> {

    return new Observable(observer => {

      const socket = this.webSocketFactory.create(
        '/ws/notifications',
        {
          userId
        }
      );

      socket.onopen = () => {
        console.log('Notification websocket conectado');
      };

      socket.onmessage = event => {

        try {

          const message =
            JSON.parse(event.data) as NotificationUser;

          observer.next(message);

        } catch (error) {

          console.error(
            'Mensaje de notificación inválido',
            error
          );
        }
      };

      socket.onerror = error => observer.error(error);

      socket.onclose = () => observer.complete();

      return () => socket.close();
    });
  }
    override disconnect(): void {
    throw new Error('Method not implemented.');
  }

}