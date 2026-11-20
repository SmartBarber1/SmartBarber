import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { BarberServiConfigComponent } from './crud-servicios.component';
import { BarberServiceService } from '../../service/barber-service.service';
import { SessionService } from '../../../../core/auth/services/session.service';

describe('BarberServiConfigComponent', () => {
  let component: BarberServiConfigComponent;
  let fixture: ComponentFixture<BarberServiConfigComponent>;
  const barberService = {
    getServicesByBarberiaId: jasmine.createSpy('getServicesByBarberiaId').and.returnValue(of([])),
    createService: jasmine.createSpy('createService').and.returnValue(of({})),
    updateService: jasmine.createSpy('updateService').and.returnValue(of({}))
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BarberServiConfigComponent],
      providers: [
        { provide: BarberServiceService, useValue: barberService },
        { provide: SessionService, useValue: { getBarbershopId: () => 'barberia-de-la-sesion' } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BarberServiConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('usa siempre la barbería de la sesión', () => {
    expect(component.currentBarberiaId).toBe('barberia-de-la-sesion');
    expect(barberService.getServicesByBarberiaId).toHaveBeenCalledWith('barberia-de-la-sesion');
  });
});
