import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Aviso que acompaña al botón "Continuar con Google".
 *
 * Al iniciar sesión, Google entrega a la plataforma el nombre y el correo del
 * usuario; por eso el titular debe estar informado antes de hacer clic
 * (autorización por conducta inequívoca, Decreto 1377 de 2013).
 */
@Component({
  selector: 'app-auth-legal-notice',
  standalone: true,
  template: `
    <p class="auth-legal-notice">
      Al continuar con Google aceptas los
      <a href="/legal/terminos" target="_blank" rel="noopener">Términos y condiciones<span class="visually-hidden"> (se abre en una pestaña nueva)</span></a>
      y autorizas el tratamiento de tus datos conforme a la
      <a href="/legal/privacidad" target="_blank" rel="noopener">Política de tratamiento de datos<span class="visually-hidden"> (se abre en una pestaña nueva)</span></a>.
    </p>
  `,
  styles: [`
    .auth-legal-notice {
      margin-top: 14px;
      font-family: 'Inter', sans-serif;
      font-size: 12.5px;
      line-height: 1.6;
      text-align: center;
      color: var(--ivory-dim, #E2D8C4);
      opacity: 0.9;
    }
    .auth-legal-notice a {
      color: var(--brass-soft, #c9a97a);
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .auth-legal-notice a:hover,
    .auth-legal-notice a:focus-visible {
      color: var(--ivory, #EFE7D8);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthLegalNoticeComponent {}
