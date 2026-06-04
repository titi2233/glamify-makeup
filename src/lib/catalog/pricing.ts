import type { Money } from "@/lib/catalog/types";

/** Normaliza Decimal/string/number a number. null/undefined → 0. Lanza si no es finito. */
export function toNumber(value: Money | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value.toString());
  if (!Number.isFinite(n)) throw new Error(`Monto inválido: ${String(value)}`);
  return n;
}

interface PricedProduct {
  basePrice: Money;
  compareAtPrice?: Money | null;
}
interface PricedVariant {
  priceOverride?: Money | null;
}

/** Precio efectivo unitario: variant.priceOverride ?? product.basePrice. */
export function getEffectivePrice(product: PricedProduct, variant?: PricedVariant | null): number {
  if (variant && variant.priceOverride !== null && variant.priceOverride !== undefined) {
    return toNumber(variant.priceOverride);
  }
  return toNumber(product.basePrice);
}

/** En oferta solo si compareAtPrice existe y es estrictamente mayor a basePrice. */
export function isOnSale(product: PricedProduct): boolean {
  if (product.compareAtPrice === null || product.compareAtPrice === undefined) return false;
  return toNumber(product.compareAtPrice) > toNumber(product.basePrice);
}

/** Porcentaje de descuento redondeado (0 si no hay oferta). */
export function getDiscountPercent(product: PricedProduct): number {
  if (!isOnSale(product)) return 0;
  const base = toNumber(product.basePrice);
  const compare = toNumber(product.compareAtPrice as Money);
  if (compare <= 0) return 0;
  return Math.round(((compare - base) / compare) * 100);
}
