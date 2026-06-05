import { slugify } from "@/lib/admin/slug";
import { isValidSku } from "@/lib/sku";

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

export interface VariantFormInput {
  name: string;
  swatchHex: string | null;
  sku: string;
  stock: number;
  lowStockThreshold: number;
  priceOverride: number | null;
  weightGrOverride: number | null;
  image: string | null;
  active: boolean;
  order: number;
}

export interface ProductFormInput {
  name: string;
  slug: string;
  description: string | null;
  categoryId: string;
  basePrice: number;
  compareAtPrice: number | null;
  cost: number;
  weightGr: number;
  images: string[];
  isFeatured: boolean;
  heroRank: number | null;
  tags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  active: boolean;
  variants: VariantFormInput[];
}

export interface VariantClean {
  name: string;
  swatchHex: string | null;
  sku: string;
  stock: number;
  lowStockThreshold: number;
  priceOverride: number | null;
  weightGrOverride: number | null;
  image: string | null;
  active: boolean;
  order: number;
}

export interface ProductClean {
  name: string;
  slug: string;
  description: string | null;
  categoryId: string;
  basePrice: number;
  compareAtPrice: number | null;
  cost: number;
  weightGr: number;
  images: string[];
  isFeatured: boolean;
  heroRank: number | null;
  tags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  active: boolean;
  variants: VariantClean[];
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function isPositiveInt(n: number): boolean {
  return Number.isInteger(n) && n > 0;
}
function isNonNegativeInt(n: number): boolean {
  return Number.isInteger(n) && n >= 0;
}

export function validateVariant(input: VariantFormInput): Validated<VariantClean> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "El nombre de la variante no puede estar vacío." };

  let swatchHex: string | null = null;
  if (input.swatchHex != null && input.swatchHex.trim() !== "") {
    const hex = input.swatchHex.trim();
    if (!HEX_RE.test(hex)) return { ok: false, error: "El color del tono debe ser un hex tipo #FF2E93." };
    swatchHex = hex.toUpperCase();
  }

  if (!isNonNegativeInt(input.stock)) return { ok: false, error: "El stock debe ser un número entero mayor o igual a 0." };
  if (!isNonNegativeInt(input.lowStockThreshold)) return { ok: false, error: "El aviso de bajo stock debe ser un entero mayor o igual a 0." };

  let priceOverride: number | null = null;
  if (input.priceOverride != null) {
    if (!(input.priceOverride > 0)) return { ok: false, error: "El precio especial de la variante debe ser mayor a 0." };
    priceOverride = input.priceOverride;
  }

  let weightGrOverride: number | null = null;
  if (input.weightGrOverride != null) {
    if (!isPositiveInt(input.weightGrOverride)) return { ok: false, error: "El peso especial debe ser un entero mayor a 0." };
    weightGrOverride = input.weightGrOverride;
  }

  let sku = "";
  if (input.sku.trim() !== "") {
    sku = input.sku.trim().toUpperCase();
    if (!isValidSku(sku)) return { ok: false, error: `El SKU "${input.sku}" no tiene un formato válido (ej. LAB-0007).` };
  }

  const image = input.image != null && input.image.trim() !== "" ? input.image.trim() : null;

  return {
    ok: true,
    value: {
      name,
      swatchHex,
      sku,
      stock: input.stock,
      lowStockThreshold: input.lowStockThreshold,
      priceOverride,
      weightGrOverride,
      image,
      active: input.active,
      order: Number.isInteger(input.order) ? input.order : 0,
    },
  };
}

export function validateProduct(input: ProductFormInput): Validated<ProductClean> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "El nombre del producto no puede estar vacío." };

  const slug = slugify(input.slug.trim() !== "" ? input.slug : name);
  if (!slug) return { ok: false, error: "No se pudo generar un enlace (slug) válido a partir del nombre." };

  if (!input.categoryId.trim()) return { ok: false, error: "Elegí una categoría para el producto." };

  if (!(input.basePrice > 0)) return { ok: false, error: "El precio debe ser mayor a 0." };
  if (input.cost < 0) return { ok: false, error: "El costo no puede ser negativo." };
  if (!isPositiveInt(input.weightGr)) return { ok: false, error: "El peso (en gramos) debe ser un entero mayor a 0." };

  let compareAtPrice: number | null = null;
  if (input.compareAtPrice != null) {
    if (!(input.compareAtPrice > input.basePrice)) {
      return { ok: false, error: "El precio anterior (oferta) tiene que ser mayor al precio actual." };
    }
    compareAtPrice = input.compareAtPrice;
  }

  let heroRank: number | null = null;
  if (input.heroRank != null) {
    if (!isPositiveInt(input.heroRank)) return { ok: false, error: "El orden en portada debe ser un entero mayor a 0." };
    heroRank = input.heroRank;
  }

  const tags = Array.from(
    new Set(input.tags.map((t) => t.trim().toLowerCase()).filter((t) => t !== "")),
  );
  const images = input.images.map((i) => i.trim()).filter((i) => i !== "");

  const cleanVariants: VariantClean[] = [];
  for (const v of input.variants) {
    const r = validateVariant(v);
    if (!r.ok) return { ok: false, error: r.error };
    cleanVariants.push(r.value);
  }

  const lowerNames = cleanVariants.map((v) => v.name.toLowerCase());
  if (new Set(lowerNames).size !== lowerNames.length) {
    return { ok: false, error: "Hay variantes con el mismo nombre. Cada tono debe tener un nombre distinto." };
  }

  const manualSkus = cleanVariants.map((v) => v.sku).filter((s) => s !== "");
  if (new Set(manualSkus).size !== manualSkus.length) {
    return { ok: false, error: "Hay variantes con el mismo SKU. Cada SKU debe ser único." };
  }

  return {
    ok: true,
    value: {
      name,
      slug,
      description: input.description != null && input.description.trim() !== "" ? input.description.trim() : null,
      categoryId: input.categoryId.trim(),
      basePrice: input.basePrice,
      compareAtPrice,
      cost: input.cost,
      weightGr: input.weightGr,
      images,
      isFeatured: input.isFeatured,
      heroRank,
      tags,
      seoTitle: input.seoTitle != null && input.seoTitle.trim() !== "" ? input.seoTitle.trim() : null,
      seoDescription: input.seoDescription != null && input.seoDescription.trim() !== "" ? input.seoDescription.trim() : null,
      active: input.active,
      variants: cleanVariants,
    },
  };
}
