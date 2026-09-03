import { describe, it, expect } from "vitest";
import {
  validateProduct,
  validateVariant,
  type ProductFormInput,
  type VariantFormInput,
} from "@/lib/admin/products/validation";

const baseVariant = (over: Partial<VariantFormInput> = {}): VariantFormInput => ({
  name: "Rojo Pasión",
  swatchHex: "#FF0000",
  sku: "",
  stock: 5,
  lowStockThreshold: 3,
  priceOverride: null,
  weightGrOverride: null,
  image: null,
  active: true,
  order: 0,
  ...over,
});

const baseProduct = (over: Partial<ProductFormInput> = {}): ProductFormInput => ({
  name: "Labial Mate",
  slug: "",
  description: "Larga duración",
  categoryId: "11111111-1111-1111-1111-111111111111",
  extraCategoryIds: [],
  basePrice: 3200,
  compareAtPrice: null,
  cost: 1000,
  weightGr: 25,
  images: [],
  isFeatured: false,
  heroRank: null,
  tags: ["mate", "labial"],
  seoTitle: null,
  seoDescription: null,
  active: true,
  variants: [baseVariant()],
  ...over,
});

describe("validateVariant", () => {
  it("acepta una variante válida y limpia el nombre", () => {
    const r = validateVariant(baseVariant({ name: "  Rosa  " }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe("Rosa");
      expect(r.value.lowStockThreshold).toBe(3);
    }
  });

  it("rechaza nombre vacío", () => {
    const r = validateVariant(baseVariant({ name: "   " }));
    expect(r.ok).toBe(false);
  });

  it("rechaza stock negativo o no entero", () => {
    expect(validateVariant(baseVariant({ stock: -1 })).ok).toBe(false);
    expect(validateVariant(baseVariant({ stock: 1.5 })).ok).toBe(false);
  });

  it("rechaza lowStockThreshold negativo", () => {
    expect(validateVariant(baseVariant({ lowStockThreshold: -2 })).ok).toBe(false);
  });

  it("rechaza priceOverride <= 0 cuando viene", () => {
    expect(validateVariant(baseVariant({ priceOverride: 0 })).ok).toBe(false);
    expect(validateVariant(baseVariant({ priceOverride: -10 })).ok).toBe(false);
  });

  it("acepta priceOverride null y weightGrOverride null", () => {
    const r = validateVariant(baseVariant({ priceOverride: null, weightGrOverride: null }));
    expect(r.ok).toBe(true);
  });

  it("rechaza swatchHex con formato inválido", () => {
    expect(validateVariant(baseVariant({ swatchHex: "rojo" })).ok).toBe(false);
    expect(validateVariant(baseVariant({ swatchHex: "#FFF" })).ok).toBe(false);
  });

  it("acepta swatchHex null", () => {
    expect(validateVariant(baseVariant({ swatchHex: null })).ok).toBe(true);
  });

  it("conserva un SKU manual no vacío", () => {
    const r = validateVariant(baseVariant({ sku: "lab-0007" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.sku).toBe("LAB-0007");
  });

  it("rechaza SKU manual con formato inválido", () => {
    expect(validateVariant(baseVariant({ sku: "LAB-1" })).ok).toBe(false);
    expect(validateVariant(baseVariant({ sku: "12-3456" })).ok).toBe(false);
  });
});

describe("validateProduct", () => {
  it("acepta un producto válido, genera slug y normaliza tags", () => {
    const r = validateProduct(baseProduct({ name: "Labial Máte", slug: "", tags: ["  Mate ", "mate", ""] }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.slug).toBe("labial-mate");
      expect(r.value.tags).toEqual(["mate"]);
      expect(r.value.variants).toHaveLength(1);
    }
  });

  it("respeta un slug manual normalizándolo", () => {
    const r = validateProduct(baseProduct({ slug: "  Mi Slug  " }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.slug).toBe("mi-slug");
  });

  it("rechaza nombre vacío", () => {
    expect(validateProduct(baseProduct({ name: "  " })).ok).toBe(false);
  });

  it("rechaza categoryId vacío", () => {
    expect(validateProduct(baseProduct({ categoryId: "" })).ok).toBe(false);
  });

  it("rechaza basePrice <= 0", () => {
    expect(validateProduct(baseProduct({ basePrice: 0 })).ok).toBe(false);
  });

  it("rechaza cost negativo", () => {
    expect(validateProduct(baseProduct({ cost: -1 })).ok).toBe(false);
  });

  it("rechaza weightGr <= 0 o no entero", () => {
    expect(validateProduct(baseProduct({ weightGr: 0 })).ok).toBe(false);
    expect(validateProduct(baseProduct({ weightGr: 12.5 })).ok).toBe(false);
  });

  it("rechaza compareAtPrice menor o igual a basePrice", () => {
    expect(validateProduct(baseProduct({ basePrice: 3000, compareAtPrice: 3000 })).ok).toBe(false);
    expect(validateProduct(baseProduct({ basePrice: 3000, compareAtPrice: 2500 })).ok).toBe(false);
  });

  it("acepta compareAtPrice mayor a basePrice", () => {
    const r = validateProduct(baseProduct({ basePrice: 3000, compareAtPrice: 4000 }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.compareAtPrice).toBe(4000);
  });

  it("acepta compareAtPrice null", () => {
    expect(validateProduct(baseProduct({ compareAtPrice: null })).ok).toBe(true);
  });

  it("propaga el error si una variante es inválida", () => {
    const r = validateProduct(baseProduct({ variants: [baseVariant({ name: "" })] }));
    expect(r.ok).toBe(false);
  });

  it("rechaza variantes con nombres duplicados (case-insensitive)", () => {
    const r = validateProduct(baseProduct({ variants: [baseVariant({ name: "Rojo" }), baseVariant({ name: "rojo" })] }));
    expect(r.ok).toBe(false);
  });

  it("permite cero variantes (el servicio creará la Única)", () => {
    const r = validateProduct(baseProduct({ variants: [] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.variants).toHaveLength(0);
  });

  it("rechaza SKU manuales duplicados entre variantes", () => {
    const r = validateProduct(
      baseProduct({ variants: [baseVariant({ sku: "LAB-0001" }), baseVariant({ name: "Otra", sku: "LAB-0001" })] }),
    );
    expect(r.ok).toBe(false);
  });

  it("acepta categorías adicionales y las conserva", () => {
    const r = validateProduct(baseProduct({ extraCategoryIds: ["cat-a", "cat-b"] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.extraCategoryIds).toEqual(["cat-a", "cat-b"]);
  });

  it("deduplica categorías adicionales repetidas", () => {
    const r = validateProduct(baseProduct({ extraCategoryIds: ["cat-a", "cat-a", "cat-b"] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.extraCategoryIds).toEqual(["cat-a", "cat-b"]);
  });

  it("excluye la categoría primaria de las adicionales aunque venga tildada", () => {
    const r = validateProduct(
      baseProduct({ categoryId: "11111111-1111-1111-1111-111111111111", extraCategoryIds: ["11111111-1111-1111-1111-111111111111", "cat-b"] }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.extraCategoryIds).toEqual(["cat-b"]);
  });
});
