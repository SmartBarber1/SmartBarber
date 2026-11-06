import { Component, DestroyRef, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

interface NavSubLink {
  label: string;
  route: string;
  fragment?: string;
}

interface NavLink {
  label: string;
  route: string;
  fragment?: string;
  sublinks?: NavSubLink[];
}

/** Ancho a partir del cual se muestra la navegación de escritorio (coincide con el CSS). */
const DESKTOP_MIN_WIDTH = 1200;

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {

  private readonly document = inject(DOCUMENT);

  links: NavLink[] = [
    {
      label: 'Inicio',
      route: '/',
      fragment: 'inicio'
    },
    {
      label: 'Nosotros',
      route: '/',
      fragment: 'nosotros'
    },
    {
      label: 'Servicios',
      route: '/',
      fragment: 'servicios'
    },
    {
      label: 'Equipo',
      route: '/',
      fragment: 'equipo'
    },
    {
      label: 'Opiniones',
      route: '/',
      fragment: 'opiniones'
    },
    {
      label: 'Blog',
      route: '/',
      fragment: 'blog'
    },
    {
      label: 'Contacto',
      route: '/',
      fragment: 'reservar',
      sublinks: [
        {
          label: 'Suscripción / Planes',
          route: '/subscription'
        }
      ]
    }
  ];

  isMenuOpen = false;

  @ViewChild('menuToggle') private menuToggle?: ElementRef<HTMLButtonElement>;
  @ViewChild('closeButton') private closeButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('drawer') private drawer?: ElementRef<HTMLElement>;

  constructor() {
    // Cualquier navegación (incluido el botón "atrás") cierra el menú.
    inject(Router).events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => this.closeMenu());

    inject(DestroyRef).onDestroy(() => this.setScrollLock(false));
  }

  toggleMenu(): void {
    if (this.isMenuOpen) {
      this.closeMenu(true);
    } else {
      this.openMenu();
    }
  }

  openMenu(): void {
    this.isMenuOpen = true;
    this.setScrollLock(true);
    // Se espera a que el panel deje de estar inerte y se pinte visible para poder enfocarlo.
    setTimeout(() => requestAnimationFrame(() => this.closeButton?.nativeElement.focus()));
  }

  /** Cierra el menú; con returnFocus devuelve el foco al botón que lo abrió. */
  closeMenu(returnFocus = false): void {
    if (!this.isMenuOpen) {
      return;
    }
    this.isMenuOpen = false;
    this.setScrollLock(false);
    if (returnFocus) {
      this.menuToggle?.nativeElement.focus();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenu(true);
  }

  /** Si la pantalla pasa a tamaño escritorio con el menú abierto, se cierra. */
  @HostListener('window:resize')
  onResize(): void {
    if (this.isMenuOpen && window.innerWidth >= DESKTOP_MIN_WIDTH) {
      this.closeMenu();
    }
  }

  /** Mantiene el foco dentro del panel mientras está abierto (ventana modal). */
  onDrawerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.drawer) {
      return;
    }
    const focusable = Array.from(
      this.drawer.nativeElement.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
    );
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = this.document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /** Evita que la página de fondo se desplace mientras el menú está abierto. */
  private setScrollLock(locked: boolean): void {
    this.document.body.style.overflow = locked ? 'hidden' : '';
  }
}
