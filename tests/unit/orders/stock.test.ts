import { describe, it, expect } from "vitest";
import { computeStockDecrements, checkAvailability } from "@/lib/orders/stock";
import type { CartLine } from "@/lib/cart/types";

const v = (refId: string, qty: number): CartLine => ({ id: refId, kind: "variant", refId, unitPrice: 1000, qty, weightGr: 25 });
const combo = (qty: number, components: Array<{ variantId: string; qty: number }>): CartLine => ({ id: "combo1", kind: "combo", refId: "combo1", unitPrice: 4990, qty, weightGr: 47, components });

describe("computeStockDecrements", () => {
  it("acumula variantes directas", () => {
    const m = computeStockDecrements([v("a", 2), v("b", 1), v("a", 3)]);
    expect(m.get("a")).toBe(5);
    expect(m.get("b")).toBe(1);
  });
  it("expande combos a componentes (qty de combo × qty de componente)", () => {
    const m = computeStockDecrements([combo(2, [{ variantId: "a", qty: 1 }, { variantId: "b", qty: 3 }])]);
    expect(m.get("a")).toBe(2);
    expect(m.get("b")).toBe(6);
  });
  it("suma variantes directas + las de combos", () => {
    const m = computeStockDecrements([v("a", 1), combo(1, [{ variantId: "a", qty: 2 }])]);
    expect(m.get("a")).toBe(3);
  });
});

describe("checkAvailability", () => {
  it("ok cuando hay stock suficiente", () => {
    const decr = new Map([["a", 2], ["b", 1]]);
    const cur = new Map([["a", 5], ["b", 1]]);
    expect(checkAvailability(decr, cur)).toEqual({ ok: true, shortages: [] });
  });
  it("reporta faltantes", () => {
    const decr = new Map([["a", 3], ["b", 2]]);
    const cur = new Map([["a", 1], ["b", 2]]);
    const r = checkAvailability(decr, cur);
    expect(r.ok).toBe(false);
    expect(r.shortages).toEqual([{ variantId: "a", needed: 3, available: 1 }]);
  });
  it("variante ausente del stock actual = 0 disponible", () => {
    const r = checkAvailability(new Map([["x", 1]]), new Map());
    expect(r.ok).toBe(false);
    expect(r.shortages[0]).toEqual({ variantId: "x", needed: 1, available: 0 });
  });
});
