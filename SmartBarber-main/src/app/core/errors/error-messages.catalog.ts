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
    AT_003: 'No tienes permiso para realizar esta acción.',
    AT_004: 'No encontramos una cuenta de SmartBarber asociada a este correo de Google.',

    // Usuarios
    US_001: 'Los datos del usuario no son válidos.',
    US_002: 'Esta cuenta de Google ya está registrada en SmartBarber.',
    US_004: 'No encontramos una cuenta de SmartBarber asociada a este correo de Google.',
    US_005: 'El rol indicado no existe.',
    US_006: 'No tienes permiso para realizar esta acción.',

    // Barberos (empleados)
    EY_001: 'Los datos del barbero no son válidos.',
    EY_002: 'Solo el administrador de la barbería puede bloquear o desbloquear barberos.',
    EY_003: 'No puedes bloquear ni desbloquear tu propia cuenta.',
    EY_004: 'Solo se puede bloquear o desbloquear a los barberos.',
    EY_005: 'Escribe el motivo del bloqueo (entre 5 y 200 caracteres).',

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
    BP_006: 'Solo puedes modificar la información de tu propia barbería.',

    // Suscripciones de la barbería
    SB_001: 'Los datos de la suscripción no son válidos.',
    SB_002: 'No se encontró la suscripción de la barbería.',
    SB_003: 'La barbería ya tiene esta suscripción registrada.',
    SB_004: 'El estado de la suscripción no es válido.',
    SB_005: 'Ya tienes una suscripción activa, pendiente de pago o aprobada. Espera a que termine ese proceso antes de solicitar otra.',
    SB_006: 'El tipo de operación de la suscripción no es válido.',
    SB_007: 'La barbería ya tiene una suscripción activa.',
    SB_008: 'Solo el administrador de la barbería puede consultar su historial de pagos.',
    SB_009: 'Revisa los filtros: la fecha inicial no puede ser posterior a la final.',

    // Planes
    ST_001: 'Ese plan ya existe.',
    ST_002: 'No se encontró el plan seleccionado.',
    ST_003: 'El plan seleccionado no es válido.',

    // Transacciones de pago
    TS_001: 'El estado del pago no es válido.',
    TS_002: 'Este pago ya fue registrado.',
    TS_003: 'No se encontró el pago.',
    TS_004: 'Los datos del pago no son válidos.',
    TS_005: 'Este tipo de pago no está soportado.',

    // Reservas
    RES_001: 'Los datos de la reserva no son válidos.',
    RES_002: 'No se encontró la reserva.',
    RES_003: 'El estado de la reserva no es válido.',
    RES_004: 'El tipo de reserva no es válido.',
    RES_005: 'La fecha de la reserva no es válida.',
    RES_006: 'Ya tienes una reserva en ese horario.',
    RES_007: 'El barbero no está disponible en ese horario. Elige otro.',
    RES_008: 'No se encontró tu perfil de cliente. Vuelve a iniciar sesión.',
    RES_009: 'Esta reserva ya no se puede cancelar.',
    RES_010: 'La fecha de la reserva no es válida.',
    RES_011: 'El barbero no está disponible en ese horario. Elige otro.',
    RES_012: 'Esta reserva ya no se puede confirmar.',
    RES_013: 'La fila virtual no está recibiendo clientes en este momento.',
    RES_014: 'Este barbero no está disponible para recibir reservas. Elige otro.',
    RES_015: 'Solo se puede finalizar una reserva confirmada o en atención.',
    RES_016: 'La reserva todavía no ha comenzado.',
    RES_017: 'Solo se puede registrar la inasistencia de una reserva pendiente o confirmada.',
    RW_002: 'Ya calificaste esta reserva.',
    RW_003: 'Elige de 1 a 5 estrellas y escribe un comentario.',
    RW_005: 'Solo puedes calificar tus reservas finalizadas.',
    SH_003: 'Completa la jornada y el almuerzo del horario.',
    SH_005: 'La hora de inicio de la jornada debe ser anterior a la de finalización.',
    SH_006: 'El almuerzo debe quedar dentro de la jornada y empezar antes de terminar.',
    BQ_001: 'La cola virtual todavía no está configurada.',
    BQ_002: 'La cola virtual ya está abierta.',
    BQ_003: 'La cola virtual no está recibiendo clientes en este momento.',
    BQ_004: 'No hay clientes en espera.',
    BQ_005: 'Ya hay un turno en atención. Finalízalo antes de llamar al siguiente.',
    BQ_006: 'No hay un turno en atención.',
    BQ_007: 'No se encontró el barbero.',
    BQ_008: 'No hay tiempo suficiente para atender ese servicio antes de la próxima cita o del cierre.',
    BQ_009: 'Los datos del turno no son válidos.',
    BQ_010: 'El barbero no pertenece a la barbería elegida.',
    BQ_011: 'Uno o más servicios no están disponibles en esta barbería.',
    BQ_012: 'No fue posible completar la operación de la cola. Inténtalo nuevamente.',
    BQ_013: 'Ese turno ya no está en la fila.',
    BQ_014: 'El barbero está de vacaciones.',
    SC_001: 'Los datos del servicio no son válidos.',
    SC_002: 'Ya existe un servicio con ese nombre y descripción.',
    SC_003: 'Revisa los datos del servicio: nombre, descripción, duración y precio.',
    SC_004: 'No se encontró el servicio.',
    SC_005: 'Solo puedes gestionar los servicios de tu barbería.',
    SC_006: 'Este servicio ya se usó en reservas. Desactívalo en lugar de eliminarlo.',
    SC_007: 'El precio de oferta debe ser menor que el precio normal.',
    SC_008: 'Uno o más servicios ya no están disponibles en esta barbería.',

    // Días no laborables y festivos
    ND_001: 'Los datos del día no laborable no son válidos.',
    ND_002: 'Esa fecha ya está registrada como día no laborable.',
    ND_003: 'No puedes registrar una fecha que ya pasó.',
    ND_004: 'No se encontró el día no laborable.',
    ND_005: 'El rango de fechas consultado no es válido.',
    ND_006: 'La barbería no atiende en esa fecha. Elige otro día.',
    ND_007: 'Solo el administrador de la barbería puede gestionar los días no laborables.',

    // Estadísticas
    AN_001: 'El rango de fechas no es válido. Revisa que la fecha inicial no sea posterior a la final ni a hoy.',
    AN_002: 'Solo el administrador de la barbería puede consultar las estadísticas.',

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
