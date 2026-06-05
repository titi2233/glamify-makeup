import { generateSku } from "@/lib/sku";

// Re-export para que los módulos admin importen todo lo de SKU desde acá.
export { generateSku };

/**
 * Valida un prefijo de SKU de categoría: 1 a 3 letras A-Z mayúsculas.
 * (El generador `generateSku` exige el mismo formato; esto valida en el form.)
 */
export function isValidSkuPrefix(p: string): boolean {
  return /^[A-Z]{1,3}$/.test(p);
}

/**
 * Próxima secuencia para un prefijo dado: máximo número final entre los SKUs
 * existentes + 1; si no hay ninguno válido, 1. Ignora SKUs malformados.
 * Pura — el servicio le pasa los SKUs ya filtrados por prefijo desde la tx.
 */
export function nextSkuSequence(existingSkus: string[]): number {
  let max = 0;
  for (const sku of existingSkus) {
    const m = /-(\d+)$/.exec(sku); // toma el número final tras el último guion
    if (!m) continue;
    const n = Number.parseInt(m[1], 10);
    if (Number.isInteger(n) && n > max) max = n;
  }
  return max + 1;
}
