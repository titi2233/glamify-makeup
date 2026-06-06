import { describe, it, expect } from "vitest";
import { selectOrderBump, rankRelated, type BumpOffer } from "@/lib/catalog/recommend";
import type { CatalogProduct } from "@/lib/catalog/types";

const o = (id: string, price: number, variantId = id + "v"): BumpOffer => ({ productId: id, variantId, name: id, image: null, price });

describe("selectOrderBump", () => {
  it("elige el más barato no presente en el carrito", () => {
    expect(selectOrderBump([o("a", 500), o("b", 300), o("c", 800)], [])?.productId).toBe("b");
  });
  it("excluye los que ya están en el carrito (por variantId)", () => {
    expect(selectOrderBump([o("a", 500, "av"), o("b", 300, "bv")], ["bv"])?.productId).toBe("a");
  });
  it("null si no quedan candidatos", () => {
    expect(selectOrderBump([o("a", 300, "av")], ["av"])).toBeNull();
    expect(selectOrderBump([], [])).toBeNull();
  });
});

describe("rankRelated", () => {
  const p = (id: string, featured: boolean) => ({ id, isFeatured: featured }) as unknown as CatalogProduct;
  it("featured primero y corta a limit", () => {
    const r = rankRelated([p("a", false), p("b", true), p("c", true), p("d", false)], 2);
    expect(r.map((x) => x.id)).toEqual(["b", "c"]);
  });
  it("respeta el limit aunque haya más", () => {
    expect(rankRelated([p("a", false), p("b", false), p("c", false)], 2)).toHaveLength(2);
  });
});
