import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LegalDocumentComponent } from '../../components/legal-document/legal-document.component';
import { LEGAL_INFO, LegalSection } from '../../legal-info';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [LegalDocumentComponent, RouterLink],
  templateUrl: './privacy-policy.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrivacyPolicyComponent {
  readonly info = LEGAL_INFO;

  readonly sections: LegalSection[] = [
    { id: 'responsable', label: 'Responsables del tratamiento' },
    { id: 'alcance', label: 'Alcance y marco legal' },
    { id: 'roles', label: 'Responsable y encargado' },
    { id: 'datos', label: 'Datos que tratamos' },
    { id: 'finalidades', label: 'Finalidades' },
    { id: 'autorizacion', label: 'Autorización' },
    { id: 'sensibles', label: 'Datos sensibles y menores' },
    { id: 'terceros', label: 'Encargados y transferencias' },
    { id: 'derechos', label: 'Tus derechos' },
    { id: 'procedimiento', label: 'Consultas y reclamos' },
    { id: 'seguridad', label: 'Seguridad de la información' },
    { id: 'conservacion', label: 'Conservación de los datos' },
    { id: 'cambios', label: 'Cambios y vigencia' }
  ];
}
