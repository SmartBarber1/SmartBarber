/**
 * Error normalizado que la interfaz puede mostrar sin conocer el formato
 * del backend, de Firebase o del navegador.
 */
export interface ApiError {
    /** Estado HTTP. 0 cuando no hubo respuesta (sin conexión, CORS, servidor caído). */
    readonly status: number;

    /** Código del backend (por ejemplo, EY_002) o de Firebase (auth/popup-blocked). */
    readonly code: string | null;

    /** Mensaje en español, listo para mostrar. */
    readonly message: string;

    /** Errores por campo que envía el backend: { nombreDelCampo: mensaje }. */
    readonly fields: Readonly<Record<string, string>>;

    /**
     * Mensaje técnico original del servidor. Solo para diagnóstico en
     * desarrollo: nunca se muestra al usuario.
     */
    readonly detail: string | null;
}

/**
 * Mensajes propios de una pantalla. La clave puede ser un código del backend
 * (EY_002), un estado HTTP (HTTP_404), un código de Firebase (auth/popup-blocked),
 * el mensaje de un Error de dominio (USER_BLOCKED), NETWORK o DEFAULT.
 */
export type ErrorMessageOverrides = Readonly<Record<string, string>>;
