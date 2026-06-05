import { describe, it, expect } from "vitest";
import { lineTotal, cartSubtotal, cartItemCount } from "@/lib/cart/totals";
import type { CartLine } from "@/lib/cart/types";

const variant = (over: Partial<CartLine> = {}): CartLine => ({
  id: "l1", kind: "variant", refId: "v1", unitPrice: 3200, qty: 1, weightGr: 25, ...over,
});

describe("lineTotal", () => {
  it("multiplica precio × cantidad redondeado a 2", () => {
    expect(lineTotal(variant({ unitPrice: 3200, qty: 3 }))).toBe(9600);
    expect(lineTotal(variant({ unitPrice: 2990, qty: 2 }))).toBe(5980);
  });
});

describe("cartSubtotal", () => {
  it("suma los totales de línea", () => {
    const lines = [variant({ unitPrice: 3200, qty: 2 }), variant({ id: "l2", unitPrice: 2500, qty: 1 })];
    expect(cartSubtotal(lines)).toBe(8900);
  });
  it("carrito vacío = 0", () => {
    expect(cartSubtotal([])).toBe(0);
  });
});

describe("cartItemCount", () => {
  it("suma las cantidades", () => {
    expect(cartItemCount([variant({ qty: 2 }), variant({ id: "l2", qty: 3 })])).toBe(5);
  });
});
