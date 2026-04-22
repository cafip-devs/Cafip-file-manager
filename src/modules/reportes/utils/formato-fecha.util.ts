const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function formatearFechaLarga(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return `${date.getDate()} de ${MESES[date.getMonth()]} del ${date.getFullYear()}`;
}

export function formatearFechasReporte<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => formatearFechasReporte(item)) as T;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, currentValue]) => {
        if (
          (key === 'fecha' || key === 'generadoEn') &&
          (typeof currentValue === 'string' || currentValue instanceof Date)
        ) {
          return [key, formatearFechaLarga(currentValue)] as const;
        }

        return [key, formatearFechasReporte(currentValue)] as const;
      },
    );

    return Object.fromEntries(entries) as T;
  }

  return value;
}
