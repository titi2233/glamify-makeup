import "server-only";
import { prisma } from "@/lib/prisma";
import { PRODUCT_INCLUDE } from "@/lib/catalog/queries";
import { getEffectivePrice } from "@/lib/catalog/pricing";
import { rankRelated, type BumpOffer } from "@/lib/catalog/recommend";
import type { CatalogProduct } from "@/lib/catalog/types";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

/** Candidatos a order-bump: productos con tag "order-bump", activos y con stock, proyectados a BumpOffer. */
export async function getOrderBumpOffers(): Promise<BumpOffer[]> {
  const rows = await prisma.product.findMany({
    where: {
      active: true,
      deletedAt: null,
      tags: { has: "order-bump" },
      variants: { some: { active: true, stock: { gt: 0 } } },
    },
    include: PRODUCT_INCLUDE,
  });
  return (rows as CatalogProduct[])
    .map((p): BumpOffer | null => {
      const variant = p.variants.find((v) => v.active && v.stock > 0);
      if (!variant) return null;
      return {
        productId: p.id,
        variantId: variant.id,
        name: p.name,
        image: variant.image ?? p.images[0] ?? null,
        price: getEffectivePrice(p, variant),
      };
    })
    .filter((x): x is BumpOffer => x !== null);
}

/** "Te puede gustar": misma categoría, excluye el producto actual; destacados primero. */
export async function getRelatedProducts(productId: string, categoryId: string, limit = 4): Promise<CatalogProduct[]> {
  const rows = await prisma.product.findMany({
    where: { active: true, deletedAt: null, categoryId, id: { not: productId } },
    include: PRODUCT_INCLUDE,
    take: limit * 3,
  });
  return rankRelated(rows as CatalogProduct[], limit);
}

/** Cross-sell del carrito: productos de las categorías del carrito, excluyendo los que ya están. */
export async function getCartCrossSell(
  categoryIds: string[],
  excludeProductIds: string[],
  limit = 4,
): Promise<CatalogProduct[]> {
  if (categoryIds.length === 0) return [];
  const rows = await prisma.product.findMany({
    where: {
      active: true,
      deletedAt: null,
      categoryId: { in: categoryIds },
      id: { notIn: excludeProductIds.length ? excludeProductIds : [NIL_UUID] },
    },
    include: PRODUCT_INCLUDE,
    take: limit * 3,
  });
  return rankRelated(rows as CatalogProduct[], limit);
}
