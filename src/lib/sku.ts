/**
 * Generador de SKU (blueprint 01 §3).
 * Formato: {PREFIJO}-{NNNN} — prefijo de hasta 3 letras (de Category.skuPrefix),
 * secuencia por categoría con padding mínimo a 4 dígitos.
 */
export function generateSku(prefix: string, sequence: number): string {
  const clean = prefix.trim().toUpperCase().slice(0, 3);
  if (!/^[A-Z]{1,3}$/.test(clean)) {
    throw new Error(`Prefijo de SKU inválido: "${prefix}"`);
  }
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`Secuencia de SKU inválida: ${sequence}`);
  }
  return `${clean}-${String(sequence).padStart(4, "0")}`;
}

export function isValidSku(sku: string): boolean {
  return /^[A-Z]{1,3}-\d{4,}$/.test(sku);
}
