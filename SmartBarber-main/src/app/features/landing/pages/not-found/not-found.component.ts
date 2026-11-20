import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Página que se muestra cuando la dirección no corresponde a ninguna sección. */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="not-found">
      <div class="wrap not-found__inner">
        <p class="not-found__code">404</p>
        <h1>Página no encontrada</h1>
        <p>La dirección que abriste no existe o cambió de lugar.</p>
        <a routerLink="/" class="btn btn-primary">Ir al inicio</a>
      </div>
    </section>
  `,
  styles: [`
    .not-found {
      min-height: 60vh;
      display: flex;
      align-items: center;
      padding: 140px 16px 80px;
      background: var(--ink);
      color: var(--ivory);
    }
    .not-found__inner {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .not-found__code {
      margin: 0;
      font-size: 64px;
      font-weight: 700;
      color: var(--brass);
      line-height: 1;
    }
    h1 { margin: 0; }
    p { margin: 0; color: var(--ivory-dim); }
    a { margin-top: 12px; }
  `]
})
export class NotFoundComponent {}
