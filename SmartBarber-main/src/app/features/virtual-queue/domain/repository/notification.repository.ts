import { Observable } from 'rxjs';
import { NotificationEvent } from '../model/queue-event.model';

export abstract class NotificationRepository {

  abstract connect(): Observable<NotificationEvent>;
  abstract disconnect(): void;

}