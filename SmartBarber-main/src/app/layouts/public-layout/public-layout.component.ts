import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    NavbarComponent,
    FooterComponent
  ],
  templateUrl: './public-layout.component.html',
  styleUrl: './public-layout.component.css'
})
export class PublicLayoutComponent {
  /** Lleva el foco al contenido sin cambiar la ruta (con base href, "#id" navegaría al inicio). */
  skipToContent(event: Event): void {
    event.preventDefault();
    document.getElementById('contenido-principal')?.focus();
  }
}
