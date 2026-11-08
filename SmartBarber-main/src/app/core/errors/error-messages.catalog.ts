/**
 * Catálogo de mensajes en español. Solo contiene textos: la lógica de
 * interpretación vive en api-error.mapper.ts.
 */

export const NETWORK_ERROR_MESSAGE =
    'No pudimos conectarnos con el servidor. Revisa tu conexión a internet e inténtalo de nuevo.';

export const DEFAULT_ERROR_MESSAGE =
    'Ocurrió un error inesperado. Inténtalo nuevamente.';

/** Códigos que envía el backend en { data: { code } }. */
export const BACKEND_ERROR_MESSAGES: Readonly<Record<string, string>> = {
    // Validación de campos (400 con el detalle por campo)
    VALIDATION: 'Hay datos con formato inválido. Revisa los campos marcados.',

    // Autenticación y autorización
    AT_001: 'Tu sesión expiró. Vuelve a iniciar sesión.',
    AT_002: 'Tu cuenta no está activa. Comunícate con el administrador de tu barbería o con soporte.',

    // Usuarios
    US_001: 'Los datos del usuario no son válidos.',
    US_002: 'Esta cuenta de Google ya está registrada en SmartBarber.',
    US_004: 'No encontramos una cuenta de SmartBarber asociada a este correo de Google.',
    US_005: 'El rol indicado no existe.',

    // Barberos (empleados)
    EY_001: 'Los datos del barbero no son válidos.',

    // Clientes y empleados (el backend usa los mismos códigos para ambos)
    CT_001: 'Los datos enviados no son válidos.',
    CT_002: 'Ya existe un registro con ese número de documento.',
    CT_003: 'Los datos enviados no son válidos.',
    CT_004: 'No se encontró la información solicitada.',

    // Barberías
    BA_001: 'Los datos de la barbería no son válidos.',
    BP_002: 'Ya existe una barbería registrada con esos datos.',
    BP_004: 'No se encontró la barbería.',
    BP_005: 'La barbería no tiene una suscripción activa.',

    // Errores técnicos
    TECH_001: 'Hay datos con formato inválido. Revisa la información e inténtalo de nuevo.',
    TECH_002: 'El servidor tardó demasiado en responder. Inténtalo de nuevo.',
    TECH_003: 'El servicio no está disponible en este momento. Inténtalo en unos minutos.',
    TECH_004: 'Ocurrió un error en el servidor. Inténtalo más tarde.',
    TECH_005: 'Ocurrió un error en el servidor. Inténtalo más tarde.',
    TECH_006: 'Tu sesión no es válida. Vuelve a iniciar sesión.',
    TECH_007: 'No tienes permisos para realizar esta acción.',
    TECH_008: 'Tu sesión expiró. Vuelve a iniciar sesión.'
};

/** Respaldo cuando la respuesta no trae un código conocido. */
export const HTTP_STATUS_MESSAGES: Readonly<Record<number, string>> = {
    400: 'La solicitud tiene datos inválidos. Revisa la información.',
    401: 'Tu sesión no es válida o expiró. Vuelve a iniciar sesión.',
    403: 'No tienes permisos para realizar esta acción.',
    404: 'No se encontró la información solicitada.',
    409: 'La información ya existe o entra en conflicto con otro registro.',
    422: 'La información enviada no cumple las reglas del negocio.',
    429: 'Hiciste demasiados intentos. Espera un momento e inténtalo de nuevo.',
    500: 'Ocurrió un error en el servidor. Inténtalo más tarde.',
    502: 'El servidor se está iniciando o no responde. Espera unos segundos e inténtalo de nuevo.',
    503: 'El servicio no está disponible en este momento. Inténtalo en unos minutos.',
    504: 'El servidor tardó demasiado en responder. Inténtalo de nuevo.'
};

/** Errores de Firebase Authentication (inicio de sesión con Google). */
export const FIREBASE_ERROR_MESSAGES: Readonly<Record<string, string>> = {
    'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar. Inténtalo de nuevo.',
    'auth/cancelled-popup-request': 'Ya hay una ventana de Google abierta. Termina ese proceso primero.',
    'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes para este sitio e inténtalo de nuevo.',
    'auth/network-request-failed': 'No hay conexión con Google. Revisa tu internet e inténtalo de nuevo.',
    'auth/too-many-requests': 'Hiciste demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
    'auth/user-disabled': 'Esta cuenta de Google fue deshabilitada. Comunícate con soporte.',
    'auth/unauthorized-domain': 'Este dominio no está autorizado para iniciar sesión. Comunícate con soporte.',
    'auth/operation-not-allowed': 'El inicio de sesión con Google no está habilitado. Comunícate con soporte.',
    'auth/internal-error': 'Google no pudo completar el inicio de sesión. Inténtalo de nuevo.'
};
