import { Injectable, inject, signal } from '@angular/core';
import { SessionService } from '../../../../core/auth/services/session.service';
import { AuthSessionBootstrapService } from '../../../authentication/application/services/auth-session-bootstrap.service';

import { toUserMessage } from '../../../../core/errors';
export type SubscriptionAccessStatus =
  | 'loading'
  | 'active'
  | 'approved'
  | 'inactive'
  | 'pending'
  | 'expired'
  | 'declined'
  | 'refunded'
  | 'error'
  | 'unavailable';

export interface SubscriptionAccessState {
  status: SubscriptionAccessStatus;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BarbershopSubscriptionAccessService {
  private readonly sessionService = inject(SessionService);
  private readonly authSessionBootstrap = inject(AuthSessionBootstrapService);

  readonly state = signal<SubscriptionAccessState>(
    this.getSessionStatusState()
  );

  get restrictsModules(): boolean {
    const session = this.sessionService.currentSession;

    return (
      (session?.role === 'ADMIN' || session?.role === 'BARBER') &&
      this.state().status !== 'active'
    );
  }

  refresh(): void {
    const currentSession = this.sessionService.currentSession;
    this.applySessionStatus();

    if (
      !currentSession ||
      (currentSession.role !== 'ADMIN' && currentSession.role !== 'BARBER')
    ) {
      return;
    }

    if (this.state().status === 'unavailable') {
      this.setLoading();
    }

    void this.authSessionBootstrap.refresh()
      .then(() => this.applySessionStatus())
      .catch((error: unknown) => {
        this.setError(
          toUserMessage(error, {
            AT_004: 'No encontramos el perfil de tu barbería. Cierra sesión y vuelve a ingresar.',
            DEFAULT: 'Ocurrió un error inesperado al verificar la suscripción.'
          })
        );
      });
  }

  setVerifiedStatus(
    status: Exclude<SubscriptionAccessStatus, 'loading' | 'error' | 'unavailable'>
  ): void {
    this.state.set({ status });
  }

  setLoading(): void {
    this.state.set({ status: 'loading' });
  }

  setError(message: string): void {
    this.state.set({ status: 'error', message });
  }

  private applySessionStatus(): void {
    this.state.set(this.getSessionStatusState());
  }

  private getSessionStatusState(): SubscriptionAccessState {
    const status =
      this.sessionService.currentSession?.subscriptionStatus;

    switch (status) {
      case 'ACTIVE':
        return { status: 'active' };
      case 'APPROVED':
        return { status: 'approved' };
      case 'PENDING':
        return { status: 'pending' };
      case 'DECLINED':
        return { status: 'declined' };
      case 'NOT_SUBSCRIPTION':
        return { status: 'inactive' };
      case 'EXPIRED':
        return { status: 'expired' };
      case 'REFUNDED':
        return { status: 'refunded' };
      default:
        return {
          status: 'unavailable',
          message: 'No fue posible reconocer el estado del plan de esta barbería.'
        };
    }
  }
}
