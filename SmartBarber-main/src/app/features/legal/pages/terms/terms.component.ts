import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LegalDocumentComponent } from '../../components/legal-document/legal-document.component';
import { LEGAL_INFO, LegalSection } from '../../legal-info';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [LegalDocumentComponent, RouterLink],
  templateUrl: './terms.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TermsComponent {
  readonly info = LEGAL_INFO;

  readonly sections: LegalSection[] = [
    { id: 'objeto', label: 'Objeto y aceptación' },
    { id: 'estado', label: 'Estado del servicio' },
    { id: 'definiciones', label: 'Definiciones' },
    { id: 'cuentas', label: 'Registro y cuentas' },
    { id: 'suscripciones', label: 'Suscripciones y pagos' },
    { id: 'reservas', label: 'Reservas y cola virtual' },
    { id: 'politicas', label: 'Cancelaciones e inasistencias' },
    { id: 'uso', label: 'Uso aceptable' },
    { id: 'contenido', label: 'Contenido de los usuarios' },
    { id: 'propiedad', label: 'Propiedad intelectual' },
    { id: 'responsabilidad', label: 'Responsabilidad' },
    { id: 'terminacion', label: 'Suspensión y terminación' },
    { id: 'consumidor', label: 'Derechos del consumidor' },
    { id: 'ley', label: 'Ley aplicable y contacto' }
  ];
}
