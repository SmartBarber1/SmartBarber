import { Injectable, signal } from '@angular/core';

interface StoredNotice {
  version: number;
  acknowledgedAt: string;
}

/**
 * Controla el aviso informativo de cookies.
 *
 * Hoy la plataforma solo usa almacenamiento estrictamente necesario, por lo que
 * el aviso es informativo. Si se incorporan cookies no esenciales (analítica,
 * publicidad), sube NOTICE_VERSION y convierte el aviso en una solicitud de
 * consentimiento previo antes de cargarlas.
 */
@Injectable({ providedIn: 'root' })
export class CookieNoticeService {
  private static readonly STORAGE_KEY = 'smartbarber.cookie-notice';
  private static readonly NOTICE_VERSION = 1;
  private static readonly VALIDITY_MS = 365 * 24 * 60 * 60 * 1000;

  readonly visible = signal(!this.isAcknowledged());

  acknowledge(): void {
    const value: StoredNotice = {
      version: CookieNoticeService.NOTICE_VERSION,
      acknowledgedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(CookieNoticeService.STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Sin almacenamiento disponible el aviso volverá a mostrarse; no es un error.
    }
    this.visible.set(false);
  }

  reopen(): void {
    this.visible.set(true);
  }

  private isAcknowledged(): boolean {
    try {
      const raw = localStorage.getItem(CookieNoticeService.STORAGE_KEY);
      if (!raw) {
        return false;
      }
      const stored = JSON.parse(raw) as StoredNotice;
      const age = Date.now() - new Date(stored.acknowledgedAt).getTime();
      return stored.version === CookieNoticeService.NOTICE_VERSION
        && Number.isFinite(age)
        && age < CookieNoticeService.VALIDITY_MS;
    } catch {
      return false;
    }
  }
}
