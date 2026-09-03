import { describe, it, expect, vi } from "vitest";
import {
  createProduct,
  updateProduct,
  softDeleteProduct,
  type CreateProductDeps,
  type ProductDb,
} from "@/lib/admin/products/service";
import type { ProductClean, VariantClean } from "@/lib/admin/products/validation";

const variant = (over: Partial<VariantClean> = {}): VariantClean => ({
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

const clean = (over: Partial<ProductClean> = {}): ProductClean => ({
  name: "Labial Mate",
  slug: "labial-mate",
  description: "Larga duración",
  categoryId: "cat-1",
  extraCategoryIds: [],
  basePrice: 3200,
  compareAtPrice: null,
  cost: 1000,
  weightGr: 25,
  images: [],
  isFeatured: false,
  heroRank: null,
  tags: ["mate"],
  seoTitle: null,
  seoDescription: null,
  active: true,
  variants: [variant()],
  ...over,
});

interface FakeOpts {
  prefix?: string;
  existingSkus?: string[];
  slugTaken?: boolean;
  failCreateOnce?: boolean; // simula P2002 en la primera tx.product.create
  existingVariantIds?: string[]; // variantes que YA tiene el producto en DB (para updateProduct)
  comboRefs?: string[]; // ids de variante referenciadas por algún ComboItem
}

function makeDeps(opts: FakeOpts = {}): { deps: CreateProductDeps; tx: any; db: any } {
  let createCalls = 0;
  const existingVariantIds = opts.existingVariantIds ?? [];
  const comboRefs = opts.comboRefs ?? [];
  const tx = {
    product: {
      create: vi.fn(async ({ data }: any) => {
        createCalls += 1;
        if (opts.failCreateOnce && createCalls === 1) {
          const err = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
          throw err;
        }
        return { id: "prod-1", ...data };
      }),
      update: vi.fn(async ({ data }: any) => ({ id: "prod-1", ...data })),
    },
    productVariant: {
      findMany: vi.fn(async ({ where }: any) =>
        where.productId ? existingVariantIds.map((id) => ({ id })) : (opts.existingSkus ?? []).map((sku) => ({ sku })),
      ),
      create: vi.fn(async ({ data }: any) => ({ id: "new-variant-id", ...data })),
      update: vi.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    comboItem: {
      findMany: vi.fn(async ({ where }: any) =>
        comboRefs.filter((v) => where.variantId.in.includes(v)).map((variantId) => ({ variantId })),
      ),
    },
    productCategory: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      createMany: vi.fn(async ({ data }: any) => ({ count: data.length })),
    },
  };
  const db = {
    category: {
      findUnique: vi.fn(async () => (opts.prefix ? { skuPrefix: opts.prefix } : null)),
    },
    product: {
      findFirst: vi.fn(async () => (opts.slugTaken ? { id: "other" } : null)),
      update: vi.fn(async ({ data }: any) => ({ id: "prod-1", ...data })),
    },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
  };
  const deps: CreateProductDeps = { db: db as unknown as ProductDb };
  return { deps, tx, db };
}

describe("createProduct", () => {
  it("crea el producto con sus variantes y SKU autogenerado por prefijo de categoría", async () => {
    const { deps, tx } = makeDeps({ prefix: "LAB", existingSkus: ["LAB-0001", "LAB-0002"] });
    const res = await createProduct(clean({ variants: [variant({ name: "Rojo" }), variant({ name: "Rosa" })] }), deps);
    expect(res.id).toBe("prod-1");
    const data = tx.product.create.mock.calls[0][0].data;
    const skus = data.variants.create.map((v: any) => v.sku);
    expect(skus).toEqual(["LAB-0003", "LAB-0004"]);
    expect(data.slug).toBe("labial-mate");
    expect(data.variants.create).toHaveLength(2);
  });

  it("cuando no se pasan variantes, crea una sola llamada 'Único'", async () => {
    const { deps, tx } = makeDeps({ prefix: "LAB", existingSkus: [] });
    await createProduct(clean({ variants: [] }), deps);
    const data = tx.product.create.mock.calls[0][0].data;
    expect(data.variants.create).toHaveLength(1);
    expect(data.variants.create[0].name).toBe("Único");
    expect(data.variants.create[0].sku).toBe("LAB-0001");
    expect(data.variants.create[0].stock).toBe(0);
  });

  it("respeta los SKU manuales y autogenera solo los vacíos", async () => {
    const { deps, tx } = makeDeps({ prefix: "LAB", existingSkus: ["LAB-0005"] });
    await createProduct(
      clean({ variants: [variant({ name: "A", sku: "LAB-0099" }), variant({ name: "B", sku: "" })] }),
      deps,
    );
    const skus = tx.product.create.mock.calls[0][0].data.variants.create.map((v: any) => v.sku);
    expect(skus).toEqual(["LAB-0099", "LAB-0006"]);
  });

  it("reintenta una vez ante colisión de SKU (P2002)", async () => {
    const { deps, tx } = makeDeps({ prefix: "LAB", existingSkus: ["LAB-0001"], failCreateOnce: true });
    const res = await createProduct(clean({ variants: [variant()] }), deps);
    expect(res.id).toBe("prod-1");
    expect(tx.product.create).toHaveBeenCalledTimes(2);
    // segundo intento recalcula desde la secuencia ya avanzada
    const secondSkus = tx.product.create.mock.calls[1][0].data.variants.create.map((v: any) => v.sku);
    expect(secondSkus[0]).toBe("LAB-0002");
  });

  it("falla si el slug ya está tomado", async () => {
    const { deps } = makeDeps({ prefix: "LAB", slugTaken: true });
    await expect(createProduct(clean(), deps)).rejects.toThrow(/enlace|slug/i);
  });

  it("falla si la categoría no existe", async () => {
    const { deps } = makeDeps({ prefix: undefined });
    await expect(createProduct(clean(), deps)).rejects.toThrow(/categor/i);
  });

  it("crea las categorías adicionales junto con el producto", async () => {
    const { deps, tx } = makeDeps({ prefix: "LAB" });
    await createProduct(clean({ extraCategoryIds: ["cat-gift", "cat-box"] }), deps);
    expect(tx.productCategory.deleteMany).toHaveBeenCalledWith({ where: { productId: "prod-1" } });
    expect(tx.productCategory.createMany).toHaveBeenCalledWith({
      data: [
        { productId: "prod-1", categoryId: "cat-gift" },
        { productId: "prod-1", categoryId: "cat-box" },
      ],
    });
  });

  it("sin categorías adicionales, no llama createMany", async () => {
    const { deps, tx } = makeDeps({ prefix: "LAB" });
    await createProduct(clean({ extraCategoryIds: [] }), deps);
    expect(tx.productCategory.createMany).not.toHaveBeenCalled();
  });
});

describe("updateProduct", () => {
  it("actualiza una variante existente in-place (no la borra ni la recrea)", async () => {
    const { deps, tx } = makeDeps({ prefix: "LAB", existingSkus: ["LAB-0001"], existingVariantIds: ["v1"] });
    const res = await updateProduct("prod-1", clean({ variants: [variant({ id: "v1", name: "Rojo Nuevo" })] }), deps);
    expect(res.id).toBe("prod-1");
    expect(tx.productVariant.update).toHaveBeenCalledWith({ where: { id: "v1" }, data: expect.objectContaining({ name: "Rojo Nuevo" }) });
    expect(tx.productVariant.create).not.toHaveBeenCalled();
    expect(tx.productVariant.deleteMany).not.toHaveBeenCalled();
  });

  it("crea una variante nueva (sin id) sin tocar las existentes", async () => {
    const { deps, tx } = makeDeps({ prefix: "LAB", existingSkus: ["LAB-0001"], existingVariantIds: ["v1"] });
    await updateProduct(
      "prod-1",
      clean({ variants: [variant({ id: "v1", name: "Rojo" }), variant({ name: "Rosa", sku: "" })] }),
      deps,
    );
    expect(tx.productVariant.update).toHaveBeenCalledWith({ where: { id: "v1" }, data: expect.objectContaining({ name: "Rojo" }) });
    expect(tx.productVariant.create).toHaveBeenCalledWith({ data: expect.objectContaining({ name: "Rosa", productId: "prod-1" }) });
    expect(tx.productVariant.deleteMany).not.toHaveBeenCalled();
  });

  it("borra una variante que ya no viene en el form, si ningún combo la referencia", async () => {
    const { deps, tx } = makeDeps({ prefix: "LAB", existingSkus: ["LAB-0001"], existingVariantIds: ["v1", "v2"] });
    await updateProduct("prod-1", clean({ variants: [variant({ id: "v1" })] }), deps); // v2 ya no viene
    expect(tx.productVariant.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["v2"] } } });
  });

  it("bloquea el borrado de una variante que está en un combo (FK ComboItem RESTRICT)", async () => {
    const { deps, tx } = makeDeps({
      prefix: "LAB", existingSkus: ["LAB-0001"], existingVariantIds: ["v1", "v2"], comboRefs: ["v2"],
    });
    await expect(updateProduct("prod-1", clean({ variants: [variant({ id: "v1" })] }), deps)).rejects.toThrow(/combo/i);
    expect(tx.productVariant.deleteMany).not.toHaveBeenCalled();
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it("falla si el slug pertenece a otro producto", async () => {
    const { deps } = makeDeps({ prefix: "LAB", slugTaken: true });
    await expect(updateProduct("prod-1", clean(), deps)).rejects.toThrow(/enlace|slug/i);
  });

  it("rehace las categorías adicionales (borra todas y recrea las que vienen)", async () => {
    const { deps, tx } = makeDeps({ prefix: "LAB", existingSkus: ["LAB-0001"], existingVariantIds: ["v1"] });
    await updateProduct("prod-1", clean({ variants: [variant({ id: "v1" })], extraCategoryIds: ["cat-gift"] }), deps);
    expect(tx.productCategory.deleteMany).toHaveBeenCalledWith({ where: { productId: "prod-1" } });
    expect(tx.productCategory.createMany).toHaveBeenCalledWith({
      data: [{ productId: "prod-1", categoryId: "cat-gift" }],
    });
  });
});

describe("softDeleteProduct", () => {
  it("marca deletedAt y desactiva, sin borrar la fila", async () => {
    const { deps } = makeDeps();
    const fixedNow = new Date("2026-06-05T00:00:00Z");
    await softDeleteProduct("prod-1", { ...deps, now: fixedNow });
    const call = (deps.db.product.update as any).mock.calls[0][0];
    expect(call.where).toEqual({ id: "prod-1" });
    expect(call.data.deletedAt).toEqual(fixedNow);
    expect(call.data.active).toBe(false);
  });
});
