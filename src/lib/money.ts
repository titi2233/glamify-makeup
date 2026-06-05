/** Utilidades de dinero: ARS, Decimal(12,2). Display en es-AR. */

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function parseDecimal(value: number | string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`Monto inválido: ${value}`);
  }
  return n;
}

/** Redondea a 2 decimales (half-up), corrigiendo el drift de float. Acepta string/number. */
export function round2(value: number | string): number {
  const n = parseDecimal(value);
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatARS(value: number | string): string {
  // Intl usa NBSP (U+00A0) / narrow NBSP (U+202F) entre símbolo y número;
  // lo normalizamos a un espacio normal para un output determinístico.
  return ARS.format(parseDecimal(value)).replace(/[  ]/g, " ");
}
