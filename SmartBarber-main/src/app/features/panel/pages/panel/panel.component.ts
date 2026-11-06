import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';

import { CommonModule, DOCUMENT } from '@angular/common';

import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterOutlet
} from '@angular/router';

import { Subscription, filter } from 'rxjs';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/** Por debajo de este ancho la barra lateral funciona como panel deslizable (coincide con el CSS). */
const MOBILE_MAX_WIDTH = 860;

import { SessionService } from '../../../../core/auth/services/session.service';
import { LogoutService } from '../../../../core/auth/services/logout.service';

import {
  PanelNavigationGroup,
  PanelNavigationItem,
  PanelSummary
} from '../../domain/models/panel-navigation.model';

import { PanelNavigationService } from '../../application/services/panel-navigation.service';
import { BarbershopSubscriptionAccessService } from '../../../subscription/application/services/barbershop-subscription-access.service';


@Component({
  selector: 'app-panel',

  standalone: true,

  imports: [
    CommonModule,
    RouterLink,
    RouterOutlet
  ],

  templateUrl: './panel.component.html',

  styleUrl: './panel.component.css'
})
export class PanelComponent
  implements OnInit, OnDestroy {


  private readonly sessionService =
    inject(SessionService);


  private readonly logoutService =
    inject(LogoutService);


  private readonly navigationService =
    inject(PanelNavigationService);

  readonly subscriptionAccess =
    inject(BarbershopSubscriptionAccessService);


  private readonly router =
    inject(Router);


  private sessionSubscription?: Subscription;


  readonly navigationGroups =
    computed<PanelNavigationGroup[]>(() =>
      this.navigationService.getNavigationForAccess(
        this.subscriptionAccess.restrictsModules
      )
    );


  readonly mobileMenuOpen =
    signal(false);


  /** true cuando la barra lateral se muestra como panel deslizable (celular y tableta). */
  readonly isMobileViewport =
    signal(this.matchesMobile());


  private readonly document =
    inject(DOCUMENT);


  @ViewChild('mobileMenuButton')
  private mobileMenuButton?: ElementRef<HTMLButtonElement>;


  @ViewChild('sidebarToggle')
  private sidebarToggleButton?: ElementRef<HTMLButtonElement>;


  constructor() {

    // Bloquea el desplazamiento del fondo mientras el panel lateral está abierto.
    effect(() => {
      this.document.body.style.overflow =
        this.mobileMenuOpen() && this.isMobileViewport() ? 'hidden' : '';
    });

    // Cualquier navegación (incluido "atrás") cierra el panel lateral.
    inject(Router).events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => this.closeMobileMenu());
  }


  @HostListener('window:resize')
  onResize(): void {

    this.isMobileViewport.set(this.matchesMobile());

    if (!this.isMobileViewport()) {
      this.closeMobileMenu();
    }
  }


  private matchesMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= MOBILE_MAX_WIDTH;
  }


  readonly sidebarCollapsed =
    signal(false);


  readonly userMenuOpen =
    signal(false);


  readonly logoutLoading =
    signal(false);


  readonly selectedComingSoon =
    signal<PanelNavigationItem | null>(null);


  readonly summary =
    signal<PanelSummary | null>(null);


  ngOnInit(): void {

    this.loadPanel();

    this.sessionSubscription =
      this.sessionService.session$.subscribe(() => {

        this.loadPanel();

      });

    this.subscriptionAccess.refresh();
  }


  retrySubscriptionCheck(): void {
    this.subscriptionAccess.refresh();
  }


  subscriptionAlertTitle(): string {
    switch (this.subscriptionAccess.state().status) {
      case 'loading':
        return 'Verificando el plan de tu barbería';
      case 'approved':
        return 'La suscripción fue aprobada y está pendiente de activación';
      case 'inactive':
        return 'Tu barbería no tiene un plan activo';
      case 'pending':
        return 'El pago de tu suscripción está pendiente';
      case 'expired':
        return 'La suscripción de tu barbería está vencida';
      case 'declined':
        return 'El pago de tu suscripción fue rechazado';
      case 'refunded':
        return 'La suscripción de tu barbería fue reembolsada';
      case 'error':
        return 'No fue posible consultar la suscripción';
      case 'unavailable':
        return 'No se puede verificar la suscripción todavía';
      case 'active':
        return 'Suscripción activa';
    }
  }


  subscriptionAlertMessage(): string {
    const state = this.subscriptionAccess.state();
    const isBarber = this.sessionService.currentSession?.role === 'BARBER';

    if (isBarber) {
      switch (state.status) {
        case 'inactive':
          return 'La barbería no tiene un plan activo. Avísale al administrador para que adquiera una suscripción.';
        case 'approved':
          return 'La solicitud fue aprobada y está pendiente la activación del plan. Consulta con el administrador de la barbería.';
        case 'pending':
          return 'El pago o la confirmación del plan de la barbería está pendiente. Consulta con su administrador.';
        case 'expired':
          return 'El plan de la barbería venció. Avísale al administrador para que lo renueve o adquiera otro.';
        case 'declined':
          return 'El pago del plan fue rechazado. El administrador debe revisar las opciones de adquisición o renovación.';
        case 'refunded':
          return 'El plan fue reembolsado y ya no está activo. Consulta con el administrador de la barbería.';
        case 'loading':
          return 'Estamos consultando el estado del plan de la barbería.';
        case 'active':
          return 'La barbería cuenta con una suscripción activa y vigente.';
        case 'error':
          return state.message ?? 'No fue posible consultar el estado. Puedes reintentar o avisar al administrador.';
        case 'unavailable':
          return 'Aún no es posible confirmar el estado del plan. Consulta con el administrador de tu barbería.';
      }
    }

    switch (state.status) {
      case 'loading':
        return 'Estamos consultando el estado de la suscripción.';
      case 'inactive':
        return 'Para utilizar los módulos de la plataforma, tu barbería necesita una suscripción activa. Puedes consultar los planes disponibles.';
      case 'approved':
        return 'El pago fue aprobado y el plan está pendiente de activación. Espera un momento y vuelve a consultar su estado.';
      case 'pending':
        return 'El pago o la confirmación del plan todavía está pendiente. Puedes revisar los módulos de suscripción mientras se confirma.';
      case 'expired':
        return 'El plan ya venció. Renueva o adquiere una suscripción para volver a habilitar los módulos de la plataforma.';
      case 'declined':
        return 'El pago no fue aprobado. Revisa las opciones disponibles para adquirir o renovar tu plan.';
      case 'refunded':
        return 'La suscripción fue reembolsada y no está activa. Puedes adquirir una nueva suscripción.';
      case 'error':
        return state.message ?? 'Ocurrió un error al consultar el estado. Puedes reintentar sin perder el acceso a tu perfil.';
      case 'unavailable':
        return 'No fue posible confirmar el estado de la suscripción. Inténtalo de nuevo más tarde.';
      case 'active':
        return 'Tu barbería cuenta con una suscripción activa y vigente.';
    }
  }


  subscriptionAlertIcon(): string {
    switch (this.subscriptionAccess.state().status) {
      case 'active':
        return '✓';
      case 'loading':
        return '…';
      case 'unavailable':
      case 'error':
        return 'i';
      default:
        return '!';
    }
  }


  ngOnDestroy(): void {

    this.sessionSubscription?.unsubscribe();

    // Si se sale del panel con el menú abierto, el resto del sitio debe poder desplazarse.
    this.document.body.style.overflow = '';

  }


  @HostListener('document:click')
  onDocumentClick(): void {

    this.userMenuOpen.set(false);

  }


  /** Escape cierra, en orden, el modal, el menú de usuario y el menú móvil. */
  @HostListener('document:keydown.escape')
  onEscape(): void {

    if (this.selectedComingSoon()) {
      this.closeComingSoon();
      return;
    }

    if (this.userMenuOpen()) {
      this.closeUserMenu();
      return;
    }

    if (this.mobileMenuOpen()) {
      this.closeMobileMenu(true);
    }

  }


  private loadPanel(): void {

    const session =
      this.sessionService.currentSession;


    if (!session) {
      this.summary.set(null);

      return;
    }


    this.summary.set({

      title:
        this.getWelcomeTitle(
          session.displayName
        ),

      subtitle:
        this.getWelcomeSubtitle(
          session.role
        ),

      roleLabel:
        this.getRoleLabel(
          session.role
        ),

      statusLabel:
        this.getStatusLabel(
          session.status
        ),

      userName:
        session.displayName || 'Usuario',

      email:
        session.email,

      barbershopName:
        session.barbershopName,

      tenantId:
        session.tenantId,

      userId:
        session.userId,

      clientId:
        session.clientId,

      barberId:
        session.barberId,

      barbershopId:
        session.barbershopId
    });
  }

  get currentModule(): PanelNavigationItem | null {

    if (this.isPanelHome()) {
      return null;
    }

    const currentUrl =
      this.router.url.split('?')[0];

    return (
      this.navigationGroups()
        .flatMap(group => group.items)
        .find(item =>
          currentUrl === item.route ||
          currentUrl.startsWith(
            `${item.route}/`
          )
        ) ?? null
    );
  }

  get currentModuleId(): string {
    return this.currentModule?.id ?? 'dashboard';
  }

  get isAdminUser(): boolean {
    return this.sessionService.currentSession?.role === 'ADMIN';
  }


  get currentModuleTitle(): string {

    if (this.isPanelHome()) {
      return 'PANEL DE CONTROL';
    }

    return (
      this.currentModule?.label.toUpperCase() ??
      'SMARTBARBER'
    );
  }


  get currentModuleSubtitle(): string {

    if (this.isPanelHome()) {

      return (
        this.summary()?.subtitle ??
        'Bienvenido a SmartBarber.'
      );
    }

    return (
      this.currentModule?.description ??
      'Gestiona tu información desde SmartBarber.'
    );
  }


  get availableItemCount(): number {

    return this.navigationGroups()

      .flatMap(
        group => group.items
      )

      .filter(
        item =>
          item.status === 'AVAILABLE'
      )

      .length;
  }


  get comingSoonItemCount(): number {

    return this.navigationGroups()

      .flatMap(
        group => group.items
      )

      .filter(
        item =>
          item.status === 'COMING_SOON'
      )

      .length;
  }


  toggleSidebar(): void {

    // En celular el botón del panel lateral lo cierra en lugar de contraerlo.
    if (this.isMobileViewport()) {
      this.closeMobileMenu(true);
      return;
    }

    this.sidebarCollapsed.update(
      value => !value
    );
  }


  toggleMobileMenu(): void {

    if (this.mobileMenuOpen()) {
      this.closeMobileMenu(true);
      return;
    }

    this.mobileMenuOpen.set(true);

    // Lleva el foco al panel cuando deja de estar inerte.
    setTimeout(() => this.sidebarToggleButton?.nativeElement.focus());
  }


  /** Cierra el panel lateral; con returnFocus devuelve el foco al botón que lo abrió. */
  closeMobileMenu(returnFocus = false): void {

    if (!this.mobileMenuOpen()) {
      return;
    }

    this.mobileMenuOpen.set(false);

    if (returnFocus) {
      this.mobileMenuButton?.nativeElement.focus();
    }
  }


  toggleUserMenu(): void {

    this.userMenuOpen.update(
      value => !value
    );
  }


  closeUserMenu(): void {

    this.userMenuOpen.set(false);
  }


  navigateToItem(
    item: PanelNavigationItem
  ): void {

    if (
      item.status === 'COMING_SOON'
    ) {

      this.selectedComingSoon.set(item);

      return;
    }


    this.closeMobileMenu();

    this.closeUserMenu();


    void this.router.navigateByUrl(
      item.route
    );
  }


  navigateToSubscriptionAcquisition(): void {
    this.closeMobileMenu();
    void this.router.navigateByUrl('/panel/subscription/status');
  }


  closeComingSoon(): void {

    this.selectedComingSoon.set(null);
  }


  async logout(): Promise<void> {

    if (this.logoutLoading()) {

      return;
    }


    this.logoutLoading.set(true);

    this.closeUserMenu();


    try {

      await this.logoutService.execute();

    } finally {

      this.logoutLoading.set(false);

    }
  }


  isCurrentRoute(
    route: string
  ): boolean {

    if (
      route === '/panel/home' ||
      route === '/panel'
    ) {

      return (

        this.router.url === '/panel/home' ||

        this.router.url === '/panel' ||

        this.router.url.startsWith(
          '/panel/home?'
        )

      );
    }


    return (

      this.router.url === route ||

      this.router.url.startsWith(
        `${route}/`
      )

    );
  }


  isPanelHome(): boolean {

    return (

      this.router.url === '/panel/home' ||

      this.router.url === '/panel'

    );
  }


  getRoleLabel(
    role:
      'CLIENT' |
      'ADMIN' |
      'BARBER'
  ): string {

    switch (role) {

      case 'ADMIN':
        return 'Administrador';

      case 'BARBER':
        return 'Barbero';

      case 'CLIENT':
        return 'Cliente';

      default:
        return 'Usuario';
    }
  }


  getStatusLabel(
    status:
      'ACTIVE' |
      'BLOCKED' |
      'INACTIVE'
  ): string {

    switch (status) {

      case 'ACTIVE':
        return 'Cuenta activa';

      case 'BLOCKED':
        return 'Cuenta bloqueada';

      case 'INACTIVE':
        return 'Cuenta inactiva';

      default:
        return 'Estado no disponible';
    }
  }


  getInitials(
    name: string
  ): string {

    if (!name.trim()) {

      return 'U';
    }


    const parts =
      name
        .trim()
        .split(/\s+/)
        .filter(Boolean);


    if (parts.length === 1) {

      return parts[0]
        .charAt(0)
        .toUpperCase();
    }


    return (

      parts[0].charAt(0) +

      parts[parts.length - 1].charAt(0)

    ).toUpperCase();
  }


  getWelcomeTitle(
    name: string
  ): string {

    return `Bienvenido, ${name || 'a SmartBarber'
      }`;
  }


  getWelcomeSubtitle(
    role:
      'CLIENT' |
      'ADMIN' |
      'BARBER'
  ): string {

    switch (role) {

      case 'ADMIN':
        return 'Gestiona tu barbería desde un solo lugar.';

      case 'BARBER':
        return 'Consulta tu agenda y organiza tu jornada.';

      case 'CLIENT':
        return 'Administra tus reservas y disfruta tu experiencia.';

      default:
        return 'Bienvenido a SmartBarber.';
    }
  }


  getIconPath(
    icon: string
  ): string {

    const paths:
      Record<string, string> = {


      home:
        'M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 19.5v-9ZM9 21v-6h6v6',


      profile:
        'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0',


      calendar:
        'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1Z',


      queue:
        'M5 6h14M5 12h14M5 18h14',


      history:
        'M4 12a8 8 0 1 0 2.3-5.6M4 5v5h5M12 8v4l3 2',


      bell:
        'M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4',


      users:
        'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-7a4 4 0 0 1 0 7.7M22 21v-2a4 4 0 0 0-3-3.87',


      scissors:
        'M6 4a3 3 0 1 0 0 6 3 3 0 0 0-0-6Zm0 10a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm3-5 11 9M9 15 20 6',


      clock:
        'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',


      wallet:
        'M4 6h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V7a1 1 0 0 1 1-1h16M16 13h5',


      chart:
        'M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-3M20 16V6'
    };


    return paths[icon] ?? paths['home'];
  }
}