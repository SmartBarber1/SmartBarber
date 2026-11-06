import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { LEGAL_DOCUMENTS, LEGAL_INFO, LegalSection } from '../../legal-info';

/**
 * Plantilla común de los documentos legales: encabezado, índice lateral
 * navegable por teclado y cuerpo del documento (proyectado con ng-content).
 */
@Component({
  selector: 'app-legal-document',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './legal-document.component.html',
  styleUrl: './legal-document.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LegalDocumentComponent {
  @Input({ required: true }) title = '';
  @Input({ required: true }) summary = '';
  @Input({ required: true }) sections: LegalSection[] = [];
  @Input() currentRoute = '';

  readonly info = LEGAL_INFO;
  readonly documents = LEGAL_DOCUMENTS;

  /**
   * Desplaza a la sección y le pasa el foco, para que lectores de pantalla
   * y usuarios de teclado continúen la lectura desde ese punto.
   */
  goToSection(event: Event, id: string): void {
    event.preventDefault();
    const target = document.getElementById(id);
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: this.prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    target.focus({ preventScroll: true });
  }

  print(): void {
    window.print();
  }

  private prefersReducedMotion(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }
}
