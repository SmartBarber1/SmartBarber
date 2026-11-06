import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validadores y normalizadores para datos de registro en Colombia.
 *
 * Los validadores aceptan lo que la gente suele escribir (puntos, espacios,
 * guiones, el prefijo +57) y validan sobre el valor normalizado. Antes de
 * enviar al backend se deben aplicar las funciones normalize*, para guardar
 * siempre el mismo formato y que las validaciones de duplicados funcionen.
 *
 * Fuentes de los formatos:
 * - Celulares: 10 dígitos que inician en 3 (Plan Nacional de Numeración, CRC).
 *   No se usa una lista cerrada de prefijos porque la CRC asigna rangos nuevos (p. ej. 333).
 * - Fijos: marcación nacional de 10 dígitos desde 2021: 60 + indicativo (1-8) + 7 dígitos
 *   (Resolución CRC 5826 de 2019).
 * - NIT: número base + dígito de verificación (módulo 11 con pesos primos, DIAN).
 */

export type ColombianDocumentType = 'CC' | 'CE' | 'NIT';

/** Tipos de documento admitidos para personas naturales. */
export const PERSON_DOCUMENT_TYPES: readonly ColombianDocumentType[] = ['CC', 'CE'];

/** Tipos de documento admitidos para una barbería (empresa o persona natural comerciante). */
export const BUSINESS_DOCUMENT_TYPES: readonly ColombianDocumentType[] = ['NIT', 'CC', 'CE'];

const LETTERS = 'A-Za-zÁÉÍÓÚÜÑáéíóúüñ';
const PERSON_NAME = new RegExp(`^[${LETTERS}]+(?:['’.-]?[${LETTERS}]+)*\\.?(?: [${LETTERS}]+(?:['’.-]?[${LETTERS}]+)*\\.?)+$`);
const BUSINESS_NAME = new RegExp(`^[${LETTERS}0-9&'’.,()#\\- ]+$`);
const HAS_LETTER = new RegExp(`[${LETTERS}]`);
const ADDRESS_CHARS = new RegExp(`^[${LETTERS}0-9#°º.,/\\- ]+$`);

const CC = /^[1-9]\d{3,9}$/;       // 4 a 10 dígitos, sin cero inicial (cédulas antiguas y nuevas)
const CE = /^\d{3,10}$/;           // numérica, 3 a 10 dígitos
const NIT = /^(\d{6,10})-(\d)$/;   // base de 6 a 10 dígitos + dígito de verificación
const MOBILE = /^3\d{9}$/;
const LANDLINE = /^60[1-8]\d{7}$/;

// ---------------------------------------------------------------------------
// Normalizadores
// ---------------------------------------------------------------------------

/** Quita espacios sobrantes al inicio, al final y entre palabras. */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

/** Teléfono: solo dígitos, sin el indicativo de país +57. */
export function normalizePhone(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('57') ? digits.slice(2) : digits;
}

/**
 * Documento: CC y CE quedan solo con dígitos; el NIT queda como "base-DV"
 * (por ejemplo, 900123456-8), que es la forma en que lo expide la DIAN.
 */
export function normalizeDocument(type: ColombianDocumentType | string | null | undefined, value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  if (type === 'NIT') {
    const compact = raw.replace(/[\s.]/g, '').replace(/[–—]/g, '-');
    return compact;
  }
  return raw.replace(/[\s.,-]/g, '');
}

// ---------------------------------------------------------------------------
// NIT
// ---------------------------------------------------------------------------

const NIT_WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

/** Calcula el dígito de verificación de un NIT (DIAN, módulo 11). */
export function nitCheckDigit(base: string): number {
  const digits = base.split('').reverse();
  const sum = digits.reduce((acc, digit, index) => acc + Number(digit) * NIT_WEIGHTS[index], 0);
  const remainder = sum % 11;
  return remainder > 1 ? 11 - remainder : remainder;
}

// ---------------------------------------------------------------------------
// Validadores
// ---------------------------------------------------------------------------

/** Rechaza valores que solo contienen espacios. */
export function notBlankValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return normalizeText(String(value)).length === 0 ? { blank: true } : null;
  };
}

/** Nombre completo de una persona: solo letras y al menos nombre y apellido. */
export function personNameValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = normalizeText(control.value);
    if (!value) {
      return null;
    }
    return PERSON_NAME.test(value) ? null : { personName: true };
  };
}

/** Nombre comercial o razón social: letras, números y signos usuales (&, ., -, etc.). */
export function businessNameValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = normalizeText(control.value);
    if (!value) {
      return null;
    }
    return BUSINESS_NAME.test(value) && HAS_LETTER.test(value) ? null : { businessName: true };
  };
}

/** Dirección colombiana: debe incluir texto y número (p. ej. "Cra. 15 # 93-47"). */
export function colombianAddressValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = normalizeText(control.value);
    if (!value) {
      return null;
    }
    const valid = ADDRESS_CHARS.test(value) && HAS_LETTER.test(value) && /\d/.test(value);
    return valid ? null : { address: true };
  };
}

/** Celular colombiano: 10 dígitos que inician en 3. */
export function mobilePhoneValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = normalizePhone(control.value);
    if (!value) {
      return null;
    }
    return MOBILE.test(value) ? null : { mobilePhone: true };
  };
}

/** Teléfono de contacto de un negocio: celular o fijo con la marcación nacional de 10 dígitos. */
export function businessPhoneValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = normalizePhone(control.value);
    if (!value) {
      return null;
    }
    return MOBILE.test(value) || LANDLINE.test(value) ? null : { businessPhone: true };
  };
}

/**
 * Número de documento según el tipo elegido en el control hermano.
 * Cuando cambie el tipo, llama a updateValueAndValidity() sobre el documento.
 */
export function documentNumberValidator(typeControlName = 'documentType'): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const type = control.parent?.get(typeControlName)?.value as ColombianDocumentType | undefined;
    const value = normalizeDocument(type, control.value);
    if (!value || !type) {
      return null;
    }

    switch (type) {
      case 'CC':
        return CC.test(value) ? null : { documentCC: true };
      case 'CE':
        return CE.test(value) ? null : { documentCE: true };
      case 'NIT': {
        const match = NIT.exec(value);
        if (!match) {
          return { documentNIT: true };
        }
        return nitCheckDigit(match[1]) === Number(match[2]) ? null : { nitCheckDigit: true };
      }
      default:
        return { documentType: true };
    }
  };
}

// ---------------------------------------------------------------------------
// Mensajes
// ---------------------------------------------------------------------------

const MESSAGES: Record<string, string> = {
  required: 'Este campo es obligatorio.',
  blank: 'Este campo no puede quedar en blanco.',
  personName: 'Escribe tu nombre y apellido usando solo letras.',
  businessName: 'Usa letras, números y signos comunes (&, ., -). Debe incluir al menos una letra.',
  address: 'Escribe una dirección válida con número, por ejemplo: Cra. 15 # 93-47.',
  mobilePhone: 'Ingresa un celular colombiano de 10 dígitos que empiece por 3.',
  businessPhone: 'Ingresa un celular (3XX XXX XXXX) o un fijo con indicativo (601 XXX XXXX).',
  documentCC: 'La cédula debe tener entre 4 y 10 dígitos, sin puntos ni letras.',
  documentCE: 'La cédula de extranjería debe tener entre 3 y 10 dígitos.',
  documentNIT: 'Escribe el NIT con su dígito de verificación, por ejemplo: 900123456-8.',
  nitCheckDigit: 'El dígito de verificación no corresponde a este NIT. Revísalo en tu RUT.',
  documentType: 'Selecciona un tipo de documento válido.'
};

/** Devuelve el mensaje del primer error del control, o null si no debe mostrarse. */
export function validationMessage(control: AbstractControl | null, extra: Record<string, string> = {}): string | null {
  if (!control || !control.errors || !control.touched) {
    return null;
  }
  for (const key of Object.keys(control.errors)) {
    if (key === 'minlength') {
      return `Debe tener al menos ${control.errors[key].requiredLength} caracteres.`;
    }
    if (key === 'maxlength') {
      return `Debe tener máximo ${control.errors[key].requiredLength} caracteres.`;
    }
    const message = extra[key] ?? MESSAGES[key];
    if (message) {
      return message;
    }
  }
  return 'Revisa este campo.';
}
