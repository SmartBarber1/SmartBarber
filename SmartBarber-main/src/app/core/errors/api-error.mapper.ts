import { HttpErrorResponse } from '@angular/common/http';

import { ApiError, ErrorMessageOverrides } from './api-error.model';
import {
    BACKEND_ERROR_MESSAGES,
    DEFAULT_ERROR_MESSAGE,
    FIREBASE_ERROR_MESSAGES,
    HTTP_STATUS_MESSAGES,
    NETWORK_ERROR_MESSAGE
} from './error-messages.catalog';
import { UserFacingError } from './user-facing-error';

/**
 * Convierte cualquier error (HTTP, Firebase o de dominio) en un ApiError.
 * Al usuario nunca se le muestran textos técnicos del servidor: solo mensajes
 * del catálogo o de la pantalla (overrides). La excepción son los mensajes por
 * campo, que el backend ya redacta en español para el formulario.
 */
export function toApiError(
    error: unknown,
    overrides: ErrorMessageOverrides = {}
): ApiError {
    if (error instanceof HttpErrorResponse) {
        return fromHttpError(error, overrides);
    }

    const firebaseCode = readFirebaseCode(error);
    if (firebaseCode) {
        return build(
            0,
            firebaseCode,
            overrides[firebaseCode]
                ?? FIREBASE_ERROR_MESSAGES[firebaseCode]
                ?? overrides['DEFAULT']
                ?? DEFAULT_ERROR_MESSAGE
        );
    }

    if (error instanceof UserFacingError) {
        return build(0, null, error.message);
    }

    // Errores de dominio lanzados por la propia aplicación: new Error('USER_BLOCKED').
    if (error instanceof Error && overrides[error.message]) {
        return build(0, error.message, overrides[error.message]);
    }

    return build(0, null, overrides['DEFAULT'] ?? DEFAULT_ERROR_MESSAGE);
}

/**
 * Mensaje listo para mostrar en formularios sin errores por campo en línea:
 * mensaje general seguido de los detalles que envió el backend.
 */
export function toUserMessage(
    error: unknown,
    overrides: ErrorMessageOverrides = {}
): string {
    const apiError = toApiError(error, overrides);
    const details = Object.values(apiError.fields);

    return details.length > 0
        ? `${apiError.message} ${details.join(' ')}`
        : apiError.message;
}

function fromHttpError(
    error: HttpErrorResponse,
    overrides: ErrorMessageOverrides
): ApiError {
    if (error.status === 0) {
        return build(0, 'NETWORK', overrides['NETWORK'] ?? NETWORK_ERROR_MESSAGE);
    }

    const payload = readPayload(error.error);
    let { code, fields } = payload;

    // El backend responde las validaciones de Bean Validation con 400 y el
    // detalle en el texto: "cell: El celular ..., name: El nombre ...".
    if (error.status === 400 && Object.keys(fields).length === 0 && payload.message) {
        const parsed = parseViolations(payload.message);
        if (Object.keys(parsed).length > 0) {
            fields = parsed;
            code = VALIDATION_CODE;
        }
    }

    const message =
        (code ? overrides[code] ?? BACKEND_ERROR_MESSAGES[code] : undefined)
        ?? overrides[`HTTP_${error.status}`]
        ?? HTTP_STATUS_MESSAGES[error.status]
        ?? overrides['DEFAULT']
        ?? DEFAULT_ERROR_MESSAGE;

    return build(error.status, code, message, fields, payload.message);
}

interface BackendErrorPayload {
    code: string | null;
    message: string | null;
    fields: Record<string, string>;
}

/** Código interno para errores de validación de campos. */
export const VALIDATION_CODE = 'VALIDATION';

/** "a.b: mensaje uno, c: mensaje dos" → { b: 'mensaje uno', c: 'mensaje dos' } */
function parseViolations(message: string): Record<string, string> {
    const fields: Record<string, string> = {};
    const pattern = /([A-Za-z_][\w.\[\]]*):\s*(.+?)(?=,\s*[A-Za-z_][\w.\[\]]*:\s|$)/g;

    for (const match of message.matchAll(pattern)) {
        const path = match[1].split('.').pop() ?? match[1];
        const text = match[2].trim();
        if (text && !fields[path]) {
            fields[path] = text;
        }
    }

    return fields;
}

/** Acepta { data: { code, fields } } (formato del backend) o { code, fields }. */
function readPayload(body: unknown): BackendErrorPayload {
    const container = asRecord(body);
    const data = asRecord(container?.['data']) ?? container;

    const code = typeof data?.['code'] === 'string' ? data['code'] : null;
    const message = typeof data?.['message'] === 'string' ? data['message'] : null;
    const rawFields = asRecord(data?.['fields']);
    const fields: Record<string, string> = {};

    if (rawFields) {
        for (const [key, value] of Object.entries(rawFields)) {
            if (typeof value === 'string' && value.trim()) {
                fields[key] = value.trim();
            }
        }
    }

    return { code, message, fields };
}

function readFirebaseCode(error: unknown): string | null {
    const code = asRecord(error)?.['code'];

    return typeof code === 'string' && code.startsWith('auth/') ? code : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null
        ? value as Record<string, unknown>
        : null;
}

function build(
    status: number,
    code: string | null,
    message: string,
    fields: Record<string, string> = {},
    detail: string | null = null
): ApiError {
    return { status, code, message, fields, detail };
}
