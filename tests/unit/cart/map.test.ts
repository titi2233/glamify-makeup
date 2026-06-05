import { describe, it, expect } from "vitest";
import { cartItemToCartLine, type CartItemWithRefs } from "@/lib/cart/cart-service";

const variantItem: CartItemWithRefs = {
  id: "ci1", qty: 2, unitPriceSnapshot: "3200", comboId: null, variantId: "v1",
  variant: {
    id: "v1", name: "Rojo Pasión", priceOverride: null, stock: 18, weightGrOverride: null,
    product: { id: "p1", name: "Labial Mate", basePrice: "3200", weightGr: 25, categoryId: "c1", slug: "labial-mate", images: [] },
  },
  combo: null,
} as unknown as CartItemWithRefs;

const comboItem: CartItemWithRefs = {
  id: "ci2", qty: 1, unitPriceSnapshot: "4990", comboId: "combo1", variantId: null,
  variant: null,
  combo: {
    id: "combo1", name: "Dúo Labios Glam", comboPrice: "4990", slug: "duo-labios-glam", images: [],
    items: [
      { variantId: "v1", qty: 1, variant: { weightGrOverride: null, product: { weightGr: 25 } } },
      { variantId: "v2", qty: 1, variant: { weightGrOverride: 22, product: { weightGr: 30 } } },
    ],
  },
} as unknown as CartItemWithRefs;

describe("cartItemToCartLine", () => {
  it("mapea una línea de variante (precio efectivo, peso, ids)", () => {
    const l = cartItemToCartLine(variantItem);
    expect(l).toMatchObject({ id: "ci1", kind: "variant", refId: "v1", unitPrice: 3200, qty: 2, weightGr: 25, productId: "p1", categoryId: "c1" });
    expect(l.components).toBeUndefined();
  });
  it("usa priceOverride y weightGrOverride de la variante si existen", () => {
    const item = { ...variantItem, variant: { ...variantItem.variant!, priceOverride: "2990", weightGrOverride: 40 } } as unknown as CartItemWithRefs;
    const l = cartItemToCartLine(item);
    expect(l.unitPrice).toBe(2990);
    expect(l.weightGr).toBe(40);
  });
  it("mapea un combo con sus componentes y peso sumado", () => {
    const l = cartItemToCartLine(comboItem);
    expect(l).toMatchObject({ id: "ci2", kind: "combo", refId: "combo1", unitPrice: 4990, qty: 1, productId: null, categoryId: null });
    expect(l.components).toEqual([{ variantId: "v1", qty: 1 }, { variantId: "v2", qty: 1 }]);
    expect(l.weightGr).toBe(47); // 25 + 22(override)
  });
});
