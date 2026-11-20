import { NavigationError } from '@angular/router';

/** Clave para no recargar en bucle si el archivo sigue sin poder descargarse. */
const RELOAD_FLAG = 'smartbarber.chunk-reload';

/**
 * El navegador no pudo descargar el archivo de una sección (por ejemplo, tras un
 * nuevo despliegue que cambió los nombres de los archivos, o por un corte de red).
 */
function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /Failed to fetch dynamically imported module|Loading chunk [\w-]+ failed|Importing a module script failed|error loading dynamically imported module/i
    .test(message);
}

/**
 * Si una sección no carga al primer clic, se recarga la página directamente en
 * esa sección (una sola vez); si vuelve a fallar se pregunta si se reintenta.
 */
export function handleChunkLoadError(event: NavigationError): void {
  if (!isChunkLoadError(event.error)) {
    return;
  }

  let alreadyReloaded = false;
  try {
    alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === event.url;
    sessionStorage.setItem(RELOAD_FLAG, event.url);
  } catch {
    // Sin almacenamiento disponible: se recarga igual.
  }

  if (!alreadyReloaded) {
    window.location.assign(event.url);
    return;
  }

  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    // Ignorado.
  }

  if (window.confirm('No fue posible abrir esta sección. Revisa tu conexión. ¿Quieres intentarlo de nuevo?')) {
    window.location.assign(event.url);
  }
}
