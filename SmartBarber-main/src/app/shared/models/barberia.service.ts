import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BarberShopRegisterRequest, BarberShopResponse } from '../../features/barber-shop/domain/models/barber-shop.model';

import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BarberiaService {
  private apiUrl = `${environment.apiUrl}/barber-service`;

  constructor(private http: HttpClient) {}

  // Petición POST enviando BarberShopRegisterRequest y esperando BarberShopResponse
  crearBarberia(barberiaData: BarberShopRegisterRequest): Observable<BarberShopResponse> {
    return this.http.post<BarberShopResponse>(`${this.apiUrl}/create-barber`, barberiaData);
  }

  // Petición GET devolviendo un arreglo de BarberShopResponse
  obtenerBarberias(): Observable<BarberShopResponse[]> {
    return this.http.get<BarberShopResponse[]>(`${this.apiUrl}/obtener-barberia-nombre`);
  }
}