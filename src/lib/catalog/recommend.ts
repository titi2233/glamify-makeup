import type { CatalogProduct } from "@/lib/catalog/types";

/** Oferta de order-bump ya proyectada (variante por defecto + precio efectivo). */
export interface BumpOffer {
  productId: string;
  variantId: string;
  name: string;
  image: string | null;
  price: number;
}

/** Elige el bump más barato cuya variante por defecto no esté ya en el carrito. null si no queda ninguno. */
export function selectOrderBump(candidates: BumpOffer[], cartVariantIds: string[]): BumpOffer | null {
  const inCart = new Set(cartVariantIds);
  const eligible = candidates.filter((c) => !inCart.has(c.variantId));
  if (eligible.length === 0) return null;
  return eligible.reduce((best, c) => (c.price < best.price ? c : best));
}

/** Ordena relacionados con destacados primero (orden estable) y corta a `limit`. */
export function rankRelated(products: CatalogProduct[], limit: number): CatalogProduct[] {
  return [...products].sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured)).slice(0, limit);
}
