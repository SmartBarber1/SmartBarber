import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../../../../core/auth/services/session.service';
import { ReservationService } from '../../services/reservation.service';
import { HistoryScope, ReservationHistoryItem } from '../../models/reservation.model';

@Component({
  selector: 'app-reservation-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reservation-history.component.html',
  styleUrls: ['./reservation-history.component.css']
})
export class ReservationHistoryComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly reservationService = inject(ReservationService);
  private readonly sessionService = inject(SessionService);
  private readonly cdr = inject(ChangeDetectorRef);

  scope: HistoryScope = 'customer';
  historyList: ReservationHistoryItem[] = [];
  isLoading = true;
  errorMessage = '';

  ngOnInit(): void {
    this.scope = this.route.snapshot.data['scope'] ?? 'customer';
    this.loadReservationHistory();
  }

  get headerTag(): string {
    return {
      customer: '✦ PANEL DE CLIENTE',
      employee: '✦ PANEL DE BARBERO',
      barbershop: '✦ PANEL DE BARBERÍA'
    }[this.scope];
  }

  get subtitle(): string {
    return {
      customer: 'Consulta y seguimiento detallado de tus servicios y citas agendadas.',
      employee: 'Citas que has atendido y que tienes programadas.',
      barbershop: 'Todas las reservas registradas en tu barbería.'
    }[this.scope];
  }

  // TODO: confirmar los nombres reales en SessionService.currentSession
  private resolveId(): string | undefined {
    const s: any = this.sessionService.currentSession;
    return {
      customer: s?.clientId,
      employee: s?.employeeId,
      barbershop: s?.barbershopId
    }[this.scope];
  }

  async loadReservationHistory(): Promise<void> {
    const id = this.resolveId();

    if (!id) {
      this.isLoading = false;
      this.errorMessage = 'No se encontró el identificador en la sesión actual.';
      this.cdr.markForCheck();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      const data = await firstValueFrom(
        this.reservationService.getReservationHistory(this.scope, id)
      );

      this.historyList = (data ?? []).sort(
        (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
    } catch (err: any) {
      console.error('Error cargando historial de reservas:', err);

      if (err.status === 401) {
        this.errorMessage = 'Sesión no autorizada o token expirado. Inicia sesión nuevamente.';
      } else if (err.status === 404) {
        this.errorMessage = 'No se encontró historial de reservas.';
      } else if (err.status === 503) {
        this.errorMessage = 'El servicio de reservas no está disponible (503). Intenta de nuevo en unos momentos.';
      } else {
        this.errorMessage = 'No se pudo obtener el historial de reservas.';
      }
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  get activeReservesCount(): number {
    return this.historyList.filter(item =>
      ['PENDING', 'CONFIRMED', 'ACTIVE', 'APPROVED'].includes(item.status)
    ).length;
  }

  get totalMinutes(): number {
    return this.historyList
      .filter(item => item.status === 'COMPLETED')
      .reduce((acc, item) => acc + (item.duration ?? 0), 0);
  }
}
