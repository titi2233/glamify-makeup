/**
 * Límites de fecha en zona horaria de Argentina (ART = UTC−3 fija, sin DST).
 * Todas las funciones devuelven un `Date` que representa ese instante en UTC,
 * listo para comparar contra `createdAt` (UTC en DB).
 */

/** Offset de ART respecto a UTC, en milisegundos (UTC−3 → 3 horas). */
export const ART_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Componentes de calendario en hora ART para un instante dado. */
function artParts(now: Date): { year: number; month: number; day: number; weekday: number } {
  const shifted = new Date(now.getTime() - ART_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(), // 0–11
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(), // 0 = domingo … 6 = sábado
  };
}

/** Convierte una medianoche ART (año/mes/día) al instante UTC equivalente. */
function artMidnightToUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0) + ART_OFFSET_MS);
}

/** Inicio del día ART (00:00 hora Argentina) que contiene a `now`, como `Date` UTC. */
export function startOfDayART(now: Date): Date {
  const { year, month, day } = artParts(now);
  return artMidnightToUtc(year, month, day);
}

/** Inicio de la semana ART (lunes 00:00 hora Argentina) que contiene a `now`, como `Date` UTC. */
export function startOfWeekART(now: Date): Date {
  const { year, month, day, weekday } = artParts(now);
  // Días desde el lunes: domingo (0) está a 6 días del lunes; resto = weekday − 1.
  const daysSinceMonday = (weekday + 6) % 7;
  return artMidnightToUtc(year, month, day - daysSinceMonday);
}

/** Inicio del mes ART (día 1 00:00 hora Argentina) que contiene a `now`, como `Date` UTC. */
export function startOfMonthART(now: Date): Date {
  const { year, month } = artParts(now);
  return artMidnightToUtc(year, month, 1);
}
