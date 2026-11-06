/**
 * Datos de los responsables del tratamiento y de contacto legal.
 *
 * SmartBarber es un proyecto de grado: los responsables son los integrantes del
 * equipo, como personas naturales y de forma conjunta. El artículo 13 del
 * Decreto 1377 de 2013 exige publicar nombre, domicilio, dirección, correo y
 * teléfono del responsable; no exige número de identificación, por lo que no
 * se publican cédulas.
 *
 * Los valores entre corchetes deben reemplazarse antes de publicar.
 */
export const LEGAL_INFO = {
  brand: 'SmartBarber',
  responsibles: [
    'Cristián Camilo Vargas Aldana',
    'Jimmy Caro Castro',
    'Jhon Alexander Cortés Pedraza',
    'Nicolás Peraza Gámez'
  ],
  academicProgram: 'Ingeniería de Software',
  institution: 'Fundación Universitaria Compensar',
  city: 'Bogotá D.C., Colombia',
  address: '[Dirección física para notificaciones]',
  privacyEmail: '[correo del proyecto para protección de datos]',
  supportEmail: '[correo del proyecto para soporte]',
  phone: '[teléfono de contacto del proyecto]',
  /** Fecha prevista de finalización del proyecto; define la vigencia de las bases de datos. */
  projectEndDate: '[fecha de cierre del proyecto]',
  effectiveDate: '5 de noviembre de 2026',
  lastUpdate: '5 de noviembre de 2026',
  version: '1.1'
} as const;

export interface LegalSection {
  id: string;
  label: string;
}

export interface LegalLink {
  route: string;
  label: string;
}

export const LEGAL_DOCUMENTS: readonly LegalLink[] = [
  { route: '/legal/privacidad', label: 'Política de privacidad' },
  { route: '/legal/terminos', label: 'Términos y condiciones' },
  { route: '/legal/cookies', label: 'Política de cookies' }
];
