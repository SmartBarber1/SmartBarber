/** Filtro de periodo inválido (fechas mal formadas, invertidas o fuera de rango). */
export class StatisticsFilterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StatisticsFilterError';
  }
}

/** La sesión no corresponde a un administrador con barbería asociada. */
export class StatisticsAccessError extends Error {
  constructor(message = 'Solo el administrador de la barbería puede consultar las estadísticas.') {
    super(message);
    this.name = 'StatisticsAccessError';
  }
}
