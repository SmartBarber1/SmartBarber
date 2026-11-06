import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LegalDocumentComponent } from '../../components/legal-document/legal-document.component';
import { LEGAL_INFO, LegalSection } from '../../legal-info';
import { CookieNoticeService } from '../../../../shared/components/cookie-notice/cookie-notice.service';

@Component({
  selector: 'app-cookies-policy',
  standalone: true,
  imports: [LegalDocumentComponent, RouterLink],
  templateUrl: './cookies-policy.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CookiesPolicyComponent {
  private readonly cookieNotice = inject(CookieNoticeService);

  readonly info = LEGAL_INFO;

  readonly sections: LegalSection[] = [
    { id: 'que-son', label: '¿Qué son las cookies?' },
    { id: 'que-usamos', label: 'Qué usamos y para qué' },
    { id: 'terceros', label: 'Servicios de terceros' },
    { id: 'consentimiento', label: 'Consentimiento' },
    { id: 'gestion', label: 'Cómo gestionarlas' },
    { id: 'cambios', label: 'Cambios' }
  ];

  showNoticeAgain(): void {
    this.cookieNotice.reopen();
  }
}
