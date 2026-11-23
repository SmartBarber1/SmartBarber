import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { SessionService } from '../../../../core/auth/services/session.service';
import { BarbershopSubscriptionAccessService } from '../../application/services/barbershop-subscription-access.service';
import { BarberShopResponse } from '../../../barber-shop/domain/models/barber-shop.model';
import { BarberShopApiService } from '../../../barber-shop/infrastructure/services/barber-shop-api.service';
import {
  ActualBarbershopSubscription,
  SubscriptionApiService
} from '../../infrastructure/api/subscription-api.service';
import { SubscriptionBarberStatus } from '../../infrastructure/subscription-ws.service';

interface SubscriptionModuleCard {
  title: string;
  description: string;
  route: string;
  icon: string;
  state: string;
  available: boolean;
}

@Component({
  selector: 'app-subscription-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './subscription-dashboard.component.html',
  styleUrl: './subscription-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubscriptionDashboardComponent implements OnInit {
  private readonly sessionService = inject(SessionService);
  private readonly barberShopApi = inject(BarberShopApiService);
  private readonly subscriptionApi = inject(SubscriptionApiService);
  private readonly subscriptionAccess = inject(BarbershopSubscriptionAccessService);

  readonly barberShop = signal<BarberShopResponse | null>(null);
  readonly actualSubscription = signal<ActualBarbershopSubscription | null>(null);
  readonly actualPlanName = signal('');
  readonly subscriptionStatus = this.subscriptionAccess.state;
  readonly loading = signal(true);
  readonly subscriptionDetailsLoading = signal(false);
  readonly errorMessage = signal('');
  readonly subscriptionDetailsError = signal('');

  readonly modules: SubscriptionModuleCard[] = [
    {
      title: 'Adquirir suscripción',
      description: 'Selecciona un plan e inicia la transacción para tu barbería.',
      route: 'status',
      icon: '+',
      state: 'Disponible',
      available: true
    },
    {
      title: 'Estado de suscripción',
      description: 'Revisa el plan actual, su vigencia y el estado del pago.',
      route: 'status',
      icon: '◉',
      state: 'Estado desde autenticación',
      available: true
    },
    {
      title: 'Renovación',
      description: 'Elige un plan para ampliar la vigencia de tu suscripción.',
      route: 'renewal',
      icon: '↻',
      state: 'Renovación automática',
      available: true
    },
    {
      // Mismo destino que "Historial de suscripción" del menú lateral.
      title: 'Historial de suscripción',
      description: 'Consulta los registros y cambios de suscripción de tu barbería.',
      route: 'subscription-history',
      icon: '▤',
      state: 'Disponible',
      available: true
    },
  ];

  subscriptionStatusLabel(): string {
    switch (this.subscriptionStatus().status) {
      case 'active':
        return 'Activa';
      case 'approved':
        return 'Aprobada';
      case 'pending':
        return 'Pendiente';
      case 'inactive':
        return 'Sin suscripción';
      case 'expired':
        return 'Vencida';
      case 'declined':
        return 'Rechazada';
      case 'refunded':
        return 'Reembolsada';
      case 'loading':
        return 'Verificando';
      case 'error':
      case 'unavailable':
        return 'No confirmada';
    }
  }

  ngOnInit(): void {
    this.loadAuthenticatedBarberShop();
  }

  private loadAuthenticatedBarberShop(): void {
    const session = this.sessionService.currentSession;

    if (!session || session.role !== 'ADMIN' || !session.barbershopId) {
      this.loading.set(false);
      this.errorMessage.set(
        'No encontramos una barbería asociada a tu perfil. Cierra sesión y vuelve a ingresar; si el problema continúa, contacta al administrador.'
      );
      return;
    }

    this.barberShopApi.getById(session.barbershopId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: barberShop => {
          if (!barberShop?.id || barberShop.id !== session.barbershopId) {
            this.errorMessage.set(
              'La barbería recibida no coincide con la asociada a tu perfil autenticado.'
            );
            return;
          }

          this.barberShop.set(barberShop);

          if (
            this.subscriptionStatus().status === 'active' &&
            session.barbershopId
          ) {
            // El backend busca la suscripción por el id de la BARBERÍA, no del empleado.
            this.loadActualSubscription(session.barbershopId);
          }
        },
        error: (error: unknown) => {
          console.error('No fue posible cargar la barbería del perfil:', error);
          this.errorMessage.set(
            'No fue posible cargar la información de la barbería asociada a tu perfil.'
          );
        }
      });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(value);
  }

  actualSubscriptionStatusLabel(status: SubscriptionBarberStatus): string {
    switch (status) {
      case 'ACTIVE':
        return 'Activa';
      case 'APPROVED':
        return 'Aprobada';
      case 'PENDING':
        return 'Pendiente';
      case 'DECLINED':
        return 'Rechazada';
      case 'EXPIRED':
        return 'Vencida';
      case 'REFUNDED':
        return 'Reembolsada';
      case 'CANCELED':
        return 'Cancelada';
      case 'NOT_SUBSCRIPTION':
        return 'Sin suscripción';
    }
  }

  private loadActualSubscription(barbershopId: string): void {
    this.subscriptionDetailsLoading.set(true);
    this.subscriptionDetailsError.set('');

    this.subscriptionApi.getActualBarbershopSubscription(barbershopId)
      .pipe(finalize(() => this.subscriptionDetailsLoading.set(false)))
      .subscribe({
        next: subscription => {
          // En la respuesta, "barberId" es el id de la barbería suscrita.
          if (subscription.barberId !== barbershopId) {
            this.subscriptionDetailsError.set(
              'La suscripción recibida no corresponde a tu barbería.'
            );
            return;
          }

          this.actualSubscription.set(subscription);
          this.actualPlanName.set(`Plan ${subscription.subscriptionId}`);
          this.subscriptionApi.getSubscriptionCatalog().subscribe({
            next: plans => {
              const plan = plans.find(item => item.id === subscription.subscriptionId);
              if (plan) {
                this.actualPlanName.set(plan.name);
              }
            },
            error: (error: unknown) => {
              console.error('No fue posible consultar el nombre del plan actual:', error);
            }
          });
        },
        error: (error: unknown) => {
          console.error('No fue posible consultar la suscripción actual:', error);
          this.subscriptionDetailsError.set(
            'No se pudieron consultar los detalles de vigencia. El estado general se conserva desde la sesión autenticada.'
          );
        }
      });
  }
}
