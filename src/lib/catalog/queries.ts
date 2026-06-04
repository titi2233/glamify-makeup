import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildPagination,
  buildProductOrderBy,
  buildProductWhere,
  PAGE_SIZE,
  type ProductListParams,
} from "@/lib/catalog/filters";
import { buildCategoryTree, findCategoryByPath, type CategoryNode } from "@/lib/catalog/categories";
import type { CatalogProduct } from "@/lib/catalog/types";

const PRODUCT_INCLUDE = {
  category: true,
  variants: { where: { active: true }, orderBy: { order: "asc" } },
} satisfies Prisma.ProductInclude;

/** Árbol de categorías activas (2 niveles). */
export async function getCategoryTree(): Promise<CategoryNode[]> {
  const rows = await prisma.category.findMany({
    where: { active: true },
    select: { id: true, slug: true, name: true, parentId: true, order: true, image: true, active: true },
    orderBy: { order: "asc" },
  });
  return buildCategoryTree(rows);
}

export interface ProductListResult {
  items: CatalogProduct[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Listado paginado de productos según params ya parseados. `categoryIds` resuelto por el caller. */
export async function getProductList(
  params: ProductListParams,
  categoryIds: string[] | null,
): Promise<ProductListResult> {
  const where = buildProductWhere(params, categoryIds);
  const { skip, take } = buildPagination(params);
  const [rows, total] = await Promise.all([
    prisma.product.findMany({ where, include: PRODUCT_INCLUDE, orderBy: buildProductOrderBy(params), skip, take }),
    prisma.product.count({ where }),
  ]);
  return {
    items: rows as CatalogProduct[],
    total,
    page: params.page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Resuelve slugs de categoría/subcategoría a ids (para filtrar) y devuelve el árbol. */
export async function resolveCategoryPath(categorySlug?: string, subcategorySlug?: string) {
  const tree = await getCategoryTree();
  const resolved = categorySlug ? findCategoryByPath(tree, categorySlug, subcategorySlug) : null;
  return { resolved, tree };
}

/** Producto por slug (activo, no borrado) con categoría + variantes activas. null si no existe. */
export async function getProductBySlug(slug: string): Promise<CatalogProduct | null> {
  const product = await prisma.product.findFirst({
    where: { slug, active: true, deletedAt: null },
    include: PRODUCT_INCLUDE,
  });
  return product as CatalogProduct | null;
}

/** Slugs de todos los productos activos (para generateStaticParams / sitemap futuro). */
export async function getActiveProductSlugs(): Promise<string[]> {
  const rows = await prisma.product.findMany({ where: { active: true, deletedAt: null }, select: { slug: true } });
  return rows.map((r) => r.slug);
}

/** Héroes de catálogo (destacados) para el Home. */
export async function getFeaturedProducts(limit = 8): Promise<CatalogProduct[]> {
  const rows = await prisma.product.findMany({
    where: { active: true, deletedAt: null, isFeatured: true },
    include: PRODUCT_INCLUDE,
    orderBy: [{ heroRank: "asc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows as CatalogProduct[];
}

/** Productos recientes (fallback del Home si no hay destacados). */
export async function getNewestProducts(limit = 8): Promise<CatalogProduct[]> {
  const rows = await prisma.product.findMany({
    where: { active: true, deletedAt: null },
    include: PRODUCT_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows as CatalogProduct[];
}
