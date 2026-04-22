const UNIDADES = [
  '',
  'uno',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
];

const DECENAS_ESPECIALES = [
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciseis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
];

const DECENAS = [
  '',
  '',
  'veinte',
  'treinta',
  'cuarenta',
  'cincuenta',
  'sesenta',
  'setenta',
  'ochenta',
  'noventa',
];

const CENTENAS = [
  '',
  'ciento',
  'doscientos',
  'trescientos',
  'cuatrocientos',
  'quinientos',
  'seiscientos',
  'setecientos',
  'ochocientos',
  'novecientos',
];

function convertirDecenas(numero: number): string {
  if (numero < 10) {
    return UNIDADES[numero];
  }

  if (numero < 20) {
    return DECENAS_ESPECIALES[numero - 10];
  }

  if (numero < 30) {
    if (numero === 20) {
      return 'veinte';
    }

    return `veinti${UNIDADES[numero - 20]}`;
  }

  const decena = Math.floor(numero / 10);
  const unidad = numero % 10;

  if (unidad === 0) {
    return DECENAS[decena];
  }

  return `${DECENAS[decena]} y ${UNIDADES[unidad]}`;
}

function convertirCentenas(numero: number): string {
  if (numero === 0) {
    return '';
  }

  if (numero === 100) {
    return 'cien';
  }

  if (numero < 100) {
    return convertirDecenas(numero);
  }

  const centena = Math.floor(numero / 100);
  const resto = numero % 100;
  const centenas = CENTENAS[centena];
  const decenas = convertirDecenas(resto);

  return [centenas, decenas].filter(Boolean).join(' ');
}

function convertirSeccion(
  numero: number,
  singular: string,
  plural: string,
): string {
  if (numero === 0) {
    return '';
  }

  if (numero === 1) {
    return singular;
  }

  return `${convertirCentenas(numero)} ${plural}`.trim();
}

function convertirEntero(numero: number): string {
  if (numero === 0) {
    return 'cero';
  }

  const millones = Math.floor(numero / 1_000_000);
  const miles = Math.floor((numero % 1_000_000) / 1_000);
  const centenas = numero % 1_000;

  const partes = [
    convertirSeccion(millones, 'un millon', 'millones'),
    miles === 1 ? 'mil' : convertirSeccion(miles, 'mil', 'mil'),
    convertirCentenas(centenas),
  ].filter(Boolean);

  return partes.join(' ').trim();
}

export function numeroAPesosEnLetras(value: number | string | null | undefined): string {
  const numericValue =
    typeof value === 'number'
      ? value
      : Number.parseFloat(String(value ?? '0').replace(/,/g, ''));

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return '';
  }

  const entero = Math.floor(numericValue);
  const centavos = Math.round((numericValue - entero) * 100);
  const letras = convertirEntero(entero);

  if (centavos === 0) {
    return `${letras} pesos`;
  }

  return `${letras} pesos con ${convertirEntero(centavos)} centavos`;
}
