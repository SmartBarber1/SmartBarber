import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { BarberServiConfigComponent } from './crud-servicios.component';
import { BarberServiceService } from '../../../../service/barber-service.service';
import { BarberShopApiService } from '../../../../infrastructure/services/barber-shop-api.service';

describe('BarberServiConfigComponent', () => {
  let component: BarberServiConfigComponent;
  let fixture: ComponentFixture<BarberServiConfigComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BarberServiConfigComponent],
      providers: [
        {
          provide: BarberServiceService,
          useValue: {
            getServicesByBarberiaId: () => of([]),
            createService: () => of({}),
            updateService: () => of({})
          }
        },
        { provide: BarberShopApiService, useValue: { getAll: () => of([]) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BarberServiConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
