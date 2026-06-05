import { describe, it, expect } from "vitest";
import { cartToCheckoutLines } from "@/lib/cart/cart-service";

const cart = {
  items: [
    { id: "ci1", qty: 2, unitPriceSnapshot: "3200", comboId: null, variantId: "v1",
      variant: { id: "v1", name: "Rojo Pasión", sku: "LAB-0001", priceOverride: null, weightGrOverride: null, product: { id: "p1", name: "Labial Mate", basePrice: "3200", weightGr: 25, categoryId: "c1" } },
      combo: null },
    { id: "ci2", qty: 1, unitPriceSnapshot: "4990", comboId: "combo1", variantId: null,
      variant: null,
      combo: { id: "combo1", name: "Dúo Labios Glam", comboPrice: "4990", items: [{ variantId: "v1", qty: 1, variant: { weightGrOverride: null, product: { weightGr: 25 } } }] } },
  ],
} as any;

describe("cartToCheckoutLines", () => {
  it("genera snapshots y título para variantes y combos", () => {
    const lines = cartToCheckoutLines(cart);
    expect(lines[0]).toMatchObject({ productNameSnapshot: "Labial Mate", variantNameSnapshot: "Rojo Pasión", skuSnapshot: "LAB-0001", title: "Labial Mate — Rojo Pasión" });
    expect(lines[0].line).toMatchObject({ kind: "variant", refId: "v1", unitPrice: 3200, qty: 2 });
    expect(lines[1]).toMatchObject({ productNameSnapshot: "Dúo Labios Glam", variantNameSnapshot: null, skuSnapshot: null, title: "Dúo Labios Glam" });
    expect(lines[1].line.kind).toBe("combo");
  });
});
