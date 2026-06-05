import { prisma } from "@/lib/prisma";
import { generateSku } from "@/lib/sku";
import { nextSkuSequence } from "@/lib/admin/sku";
import type { ProductClean, VariantClean } from "@/lib/admin/products/validation";

/** Superficie mínima del cliente transaccional usada dentro de `$transaction`. */
export interface ProductTx {
  productVariant: {
    findMany: (args: { where: { sku: { startsWith: string } }; select: { sku: true } }) => Promise<Array<{ sku: string }>>;
    deleteMany: (args: { where: { productId: string } }) => Promise<{ count: number }>;
  };
  product: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<{ id: string }>;
  };
}

/** Superficie mínima de Prisma usada por el servicio (para inyectar fakes en tests). */
export interface ProductDb {
  category: { findUnique: (args: { where: { id: string }; select: { skuPrefix: true } }) => Promise<{ skuPrefix: string } | null> };
  product: {
    findFirst: (args: { where: { slug: string; id?: { not: string }; deletedAt?: null } }) => Promise<{ id: string } | null>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<{ id: string }>;
  };
  $transaction: <T>(fn: (tx: ProductTx) => Promise<T>) => Promise<T>;
}
export interface CreateProductDeps {
  db: ProductDb;
  now?: Date;
}

export function defaultProductDeps(): CreateProductDeps {
  return { db: prisma as unknown as ProductDb };
}

/** Detecta el error de violación de unicidad de Prisma (P2002) sin usar `any`. */
function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: unknown }).code === "P2002";
}

interface VariantCreateData {
  name: string;
  swatchHex: string | null;
  sku: string;
  priceOverride: number | null;
  stock: number;
  lowStockThreshold: number;
  weightGrOverride: number | null;
  image: string | null;
  active: boolean;
  order: number;
}

/**
 * Asigna SKU a cada variante: respeta los manuales, autogenera los vacíos
 * desde `seq` (que arranca en la siguiente secuencia libre del prefijo).
 */
function assignSkus(variants: VariantClean[], prefix: string, startSeq: number): VariantCreateData[] {
  let seq = startSeq;
  return variants.map((v) => {
    const sku = v.sku !== "" ? v.sku : generateSku(prefix, seq++);
    return {
      name: v.name,
      swatchHex: v.swatchHex,
      sku,
      priceOverride: v.priceOverride,
      stock: v.stock,
      lowStockThreshold: v.lowStockThreshold,
      weightGrOverride: v.weightGrOverride,
      image: v.image,
      active: v.active,
      order: v.order,
    };
  });
}

/** Normaliza la lista de variantes: si está vacía, crea la "Única" por defecto. */
function ensureVariants(variants: VariantClean[]): VariantClean[] {
  if (variants.length > 0) return variants;
  return [
    {
      name: "Único",
      swatchHex: null,
      sku: "",
      stock: 0,
      lowStockThreshold: 3,
      priceOverride: null,
      weightGrOverride: null,
      image: null,
      active: true,
      order: 0,
    },
  ];
}

async function resolvePrefix(db: ProductDb, categoryId: string): Promise<string> {
  const cat = await db.category.findUnique({ where: { id: categoryId }, select: { skuPrefix: true } });
  if (!cat) throw new Error("La categoría elegida no existe.");
  return cat.skuPrefix;
}

function productData(input: ProductClean, variantRows: VariantCreateData[]): Record<string, unknown> {
  return {
    slug: input.slug,
    name: input.name,
    description: input.description,
    categoryId: input.categoryId,
    basePrice: input.basePrice,
    compareAtPrice: input.compareAtPrice,
    cost: input.cost,
    weightGr: input.weightGr,
    images: input.images,
    isFeatured: input.isFeatured,
    heroRank: input.heroRank,
    tags: input.tags,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    active: input.active,
    variants: { create: variantRows },
  };
}

export async function createProduct(input: ProductClean, deps: CreateProductDeps): Promise<{ id: string }> {
  const existing = await deps.db.product.findFirst({ where: { slug: input.slug, deletedAt: null } });
  if (existing) throw new Error(`Ya existe un producto con el enlace "${input.slug}". Cambiá el slug.`);

  const prefix = await resolvePrefix(deps.db, input.categoryId);
  const variants = ensureVariants(input.variants);

  const attempt = async (): Promise<{ id: string }> => {
    return deps.db.$transaction(async (tx) => {
      const rows = await tx.productVariant.findMany({ where: { sku: { startsWith: `${prefix}-` } }, select: { sku: true } });
      const startSeq = nextSkuSequence(rows.map((r) => r.sku));
      const variantRows = assignSkus(variants, prefix, startSeq);
      const created = await tx.product.create({ data: productData(input, variantRows) });
      return { id: created.id };
    });
  };

  try {
    return await attempt();
  } catch (e) {
    if (isUniqueViolation(e)) return attempt();
    throw e;
  }
}

export async function updateProduct(id: string, input: ProductClean, deps: CreateProductDeps): Promise<{ id: string }> {
  const clash = await deps.db.product.findFirst({ where: { slug: input.slug, id: { not: id }, deletedAt: null } });
  if (clash) throw new Error(`Ya existe otro producto con el enlace "${input.slug}". Cambiá el slug.`);

  const prefix = await resolvePrefix(deps.db, input.categoryId);
  const variants = ensureVariants(input.variants);

  const attempt = async (): Promise<{ id: string }> => {
    return deps.db.$transaction(async (tx) => {
      await tx.productVariant.deleteMany({ where: { productId: id } });
      const rows = await tx.productVariant.findMany({ where: { sku: { startsWith: `${prefix}-` } }, select: { sku: true } });
      const startSeq = nextSkuSequence(rows.map((r) => r.sku));
      const variantRows = assignSkus(variants, prefix, startSeq);
      const updated = await tx.product.update({ where: { id }, data: productData(input, variantRows) });
      return { id: updated.id };
    });
  };

  try {
    return await attempt();
  } catch (e) {
    if (isUniqueViolation(e)) return attempt();
    throw e;
  }
}

export async function softDeleteProduct(id: string, deps: CreateProductDeps): Promise<{ id: string }> {
  const now = deps.now ?? new Date();
  await deps.db.product.update({ where: { id }, data: { deletedAt: now, active: false } });
  return { id };
}
