import { APP_INITIALIZER, ApplicationConfig, LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling, withNavigationErrorHandler } from '@angular/router';

import { routes } from './app.routes';
import { handleChunkLoadError } from './core/routing/chunk-load-error.handler';
import { firebaseTokenInterceptor } from './core/auth/interceptors/firebase-token.interceptor';

import { AuthRepository } from './features/authentication/domain/repositories/auth.repository';
import { AuthApiService } from './features/authentication/infrastructure/api/auth-api.service';
import { AuthSessionBootstrapService } from './features/authentication/application/services/auth-session-bootstrap.service';

// Fechas, números y moneda en formato colombiano (30.000, 22/10/2026, "martes").
registerLocaleData(localeEsCo, 'es-CO');

function initializeAuthSession(
  bootstrapService: AuthSessionBootstrapService
): () => Promise<void> {
  return () => bootstrapService.restore();
}

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'es-CO' },

    provideRouter(
      routes,
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'top'
      }),
      // Si falla la descarga de una sección, se recarga en vez de quedarse quieto.
      withNavigationErrorHandler(handleChunkLoadError)
    ),

    provideHttpClient(
      withInterceptors([
        firebaseTokenInterceptor
      ])
    ),

    {
      provide: AuthRepository,
      useClass: AuthApiService
    },

    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuthSession,
      deps: [AuthSessionBootstrapService],
      multi: true
    }
  ]
};