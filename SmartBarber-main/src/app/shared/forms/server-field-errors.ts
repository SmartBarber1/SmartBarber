import { FormGroup } from '@angular/forms';

/**
 * Marca en el formulario los errores por campo que devolvió el backend.
 * El error queda como { server: 'mensaje' } y desaparece en cuanto el usuario
 * edita el campo, porque Angular vuelve a ejecutar los validadores.
 *
 * @param aliases nombre del campo en el backend → nombre del control en el formulario.
 * @returns mensajes que no corresponden a ningún control (para mostrarlos aparte).
 */
export function applyServerFieldErrors(
    form: FormGroup,
    fields: Readonly<Record<string, string>>,
    aliases: Readonly<Record<string, string>> = {}
): string[] {
    const unmatched: string[] = [];

    for (const [field, message] of Object.entries(fields)) {
        const controlName = aliases[field] ?? field;
        const control = form.get(controlName);

        if (!control) {
            unmatched.push(message);
            continue;
        }

        control.setErrors({ ...(control.errors ?? {}), server: message });
        control.markAsTouched();
    }

    return unmatched;
}
