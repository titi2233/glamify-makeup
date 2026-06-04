import type { Prisma } from "@prisma/client";

export const PAGE_SIZE = 12;

export type SortKey = "relevancia" | "precio_asc" | "precio_desc" | "novedades";
export const SORT_KEYS: SortKey[] = ["relevancia", "precio_asc", "precio_desc", "novedades"];

export interface ProductListParams {
  categorySlug?: string;
  subcategorySlug?: string;
  minPrice?: number;
  maxPrice?: number;
  onSale: boolean;
  inStockOnly: boolean;
  sort: SortKey;
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;

function firstStr(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
function toNonNegInt(v: string | undefined): number | undefined {
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

export function parseProductListParams(
  raw: RawParams,
  opts?: { categorySlug?: string; subcategorySlug?: string },
): ProductListParams {
  const sortRaw = firstStr(raw.orden) as SortKey | undefined;
  const sort: SortKey = sortRaw && SORT_KEYS.includes(sortRaw) ? sortRaw : "relevancia";
  const pageParsed = toNonNegInt(firstStr(raw.page));
  const page = pageParsed && pageParsed >= 1 ? pageParsed : 1;
  return {
    categorySlug: opts?.categorySlug,
    subcategorySlug: opts?.subcategorySlug,
    minPrice: toNonNegInt(firstStr(raw.min)),
    maxPrice: toNonNegInt(firstStr(raw.max)),
    onSale: firstStr(raw.oferta) === "1",
    inStockOnly: firstStr(raw.disponible) === "1",
    sort,
    page,
  };
}

/**
 * WHERE de Prisma para Product. `categoryIds` lo resuelve el caller (slug→id, incl. subcats).
 * Nota oferta: el seed mantiene la invariante compareAtPrice > basePrice, por eso `{ not: null }` alcanza.
 */
export function buildProductWhere(
  params: ProductListParams,
  categoryIds: string[] | null,
): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { active: true, deletedAt: null };
  if (categoryIds && categoryIds.length > 0) {
    where.categoryId = { in: categoryIds };
  }
  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    where.basePrice = {
      ...(params.minPrice !== undefined ? { gte: params.minPrice } : {}),
      ...(params.maxPrice !== undefined ? { lte: params.maxPrice } : {}),
    };
  }
  if (params.onSale) {
    where.compareAtPrice = { not: null };
  }
  if (params.inStockOnly) {
    where.variants = { some: { active: true, stock: { gt: 0 } } };
  }
  return where;
}

export function buildProductOrderBy(
  params: ProductListParams,
): Prisma.ProductOrderByWithRelationInput[] {
  switch (params.sort) {
    case "precio_asc":
      return [{ basePrice: "asc" }, { name: "asc" }];
    case "precio_desc":
      return [{ basePrice: "desc" }, { name: "asc" }];
    case "novedades":
      return [{ createdAt: "desc" }];
    case "relevancia":
    default:
      return [{ isFeatured: "desc" }, { heroRank: "asc" }, { createdAt: "desc" }];
  }
}

export function buildPagination(params: ProductListParams): { skip: number; take: number } {
  return { skip: (params.page - 1) * PAGE_SIZE, take: PAGE_SIZE };
}
