import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

let nextId = 0;

/**
 * Casilla de autorización de tratamiento de datos (Ley 1581 de 2012).
 *
 * La autorización debe ser previa, expresa e informada: la casilla nunca viene
 * marcada y enlaza a los documentos que el titular acepta.
 */
@Component({
  selector: 'app-legal-consent',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './legal-consent.component.html',
  styleUrl: './legal-consent.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LegalConsentComponent {
  @Input({ required: true }) control!: FormControl<boolean>;

  /** 'account': registro de cuenta (términos + datos). 'newsletter': solo envío de novedades. */
  @Input() purpose: 'account' | 'newsletter' = 'account';

  /** Muestra el error aunque el control no haya sido tocado (p. ej. tras intentar enviar). */
  @Input() showError = false;

  readonly inputId = `legal-consent-${++nextId}`;
  readonly errorId = `${this.inputId}-error`;

  get invalid(): boolean {
    return this.control.invalid && (this.control.touched || this.showError);
  }
}
