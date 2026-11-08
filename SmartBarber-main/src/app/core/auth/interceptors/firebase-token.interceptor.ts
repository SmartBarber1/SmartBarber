import {
  HttpInterceptorFn
} from '@angular/common/http';

import {
  inject
} from '@angular/core';

import {
  from
} from 'rxjs';

import {
  switchMap
} from 'rxjs/operators';

import {
  FirebaseAuthService
} from '../services/firebase-auth.service';

import {
  environment
} from '../../../../environments/environment';

/**
 * Agrega el token de Firebase solo a las peticiones dirigidas a la API de
 * SmartBarber. Enviarlo a otros dominios (formularios externos, APIs de
 * terceros) permitiría que ese tercero se hiciera pasar por el usuario.
 */
export function isSmartBarberApiRequest(url: string, apiUrl = environment.apiUrl): boolean {
  const base = apiUrl.replace(/\/+$/, '');

  return url === base || url.startsWith(`${base}/`);
}

export const firebaseTokenInterceptor:
  HttpInterceptorFn =
  (req, next) => {

    if (
      !isSmartBarberApiRequest(req.url) ||
      req.headers.has('Authorization')
    ) {
      return next(req);
    }

    const auth =
      inject(FirebaseAuthService);

    return from(
      auth.getIdToken()
    )
    .pipe(

      switchMap(token => {

        if (!token) {
          return next(req);
        }

        return next(
          req.clone({
            setHeaders: {
              Authorization:
                `Bearer ${token}`
            }
          })
        );
      })
    );
  };
