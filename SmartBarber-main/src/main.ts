import 'zone.js'; // <--- Agrega esta línea en la cima del archivo
import { isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// En producción no se escriben trazas en la consola del navegador: varias
// pantallas registran payloads con datos personales (nombres, documentos,
// teléfonos) que cualquiera con acceso al equipo podría leer.
if (!isDevMode()) {
  const noop = () => undefined;
  console.log = noop;
  console.info = noop;
  console.debug = noop;
}

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));