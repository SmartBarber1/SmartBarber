import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';

import { SessionService } from '../../../../core/auth/services/session.service';
import { BarberShopApiService } from '../../infrastructure/services/barber-shop-api.service';
import { BarberShopResponse } from '../../domain/models/barber-shop.model';

import { BarberiasRegistrosComponent } from './barberias-registros/barberias-registros.component';
import { DiasFestivosComponent } from './dias-festivos/dias-festivos.component';

@Component({
  selector: 'app-barber-config',
  standalone: true,
  imports: [
    CommonModule,
    BarberiasRegistrosComponent,
    DiasFestivosComponent
  ],
  templateUrl: './config.component.html',
  styleUrls: ['./config.component.css']
})
export class BarberConfigComponent implements OnInit {
  private readonly sessionService = inject(SessionService);
  private readonly barberShopApi = inject(BarberShopApiService);

  barberId = '';
  barberList: BarberShopResponse[] = [];
  selectedBarberName = '';
  selectedItem: BarberShopResponse | null = null;

  loading = false;
  errorMessage = '';
  isEditing = false;

  ngOnInit(): void {
    this.loadMyBarbershop();
  }

  loadMyBarbershop(): void {
    const barbershopId = this.sessionService.getBarbershopId();

    if (!barbershopId) {
      this.errorMessage =
        'Tu sesión no tiene una barbería asociada. Vuelve a iniciar sesión.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.barberShopApi.getById(barbershopId)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (barbershop) => {
          if (!barbershop?.id || barbershop.id !== barbershopId) {
            this.errorMessage =
              'La barbería recibida no coincide con la asociación del perfil autenticado.';
            return;
          }

          this.barberId = barbershop.id;
          this.barberList = [barbershop];
          this.selectedBarberName = barbershop.name;
          this.selectedItem = barbershop;

        },
        error: (error: unknown) => {
          console.error('Error consultando la barbería:', error);

          this.errorMessage =
            'No fue posible cargar la barbería asociada al perfil autenticado.';
        }
      });
  }

  onBarberiaSeleccionada(
    item: BarberShopResponse,
    editing = false
  ): void {
    if (!item.id) {
      return;
    }

    this.barberId = item.id;
    this.selectedBarberName = item.name;
    this.selectedItem = item;
    this.isEditing = editing;
  }

  cancelEditing(): void {
    this.isEditing = false;
  }

  /** El backend guarda el estado en español ("ACTIVO") o en inglés ("ACTIVE"). */
  isActive(shop: BarberShopResponse): boolean {
    const status = (shop.status ?? 'ACTIVO').toUpperCase();
    return status === 'ACTIVO' || status === 'ACTIVE';
  }

  statusLabel(shop: BarberShopResponse): string {
    return this.isActive(shop) ? 'Activa' : 'Inactiva';
  }
}
