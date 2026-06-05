import { describe, it, expect } from "vitest";
import { orderWeightGr, matchZone, isFreeShipping, methodFactor, type Zone } from "@/lib/shipping/quote";
import type { CartLine } from "@/lib/cart/types";

const line = (over: Partial<CartLine> = {}): CartLine => ({
  id: "l1", kind: "variant", refId: "v1", unitPrice: 1000, qty: 1, weightGr: 50, ...over,
});

describe("orderWeightGr", () => {
  it("suma peso × cantidad", () => {
    expect(orderWeightGr([line({ weightGr: 25, qty: 2 }), line({ id: "l2", weightGr: 120, qty: 1 })])).toBe(170);
  });
  it("usa default 50g si la línea no tiene peso", () => {
    expect(orderWeightGr([line({ weightGr: 0, qty: 1 })])).toBe(50);
  });
  it("carrito vacío → default 50g (nunca 0)", () => {
    expect(orderWeightGr([])).toBe(50);
  });
});

const zones: Zone[] = [
  { id: "z-amba", matchType: "cpRange", provinces: [], cpFrom: "1000", cpTo: "1900", price: 2500, active: true, order: 0 },
  { id: "z-ba", matchType: "province", provinces: ["Buenos Aires"], cpFrom: null, cpTo: null, price: 3800, active: true, order: 1 },
  { id: "z-resto", matchType: "cpRange", provinces: [], cpFrom: "0", cpTo: "9999", price: 6200, active: true, order: 3 },
];

describe("matchZone", () => {
  it("matchea por rango de CP (primer match por order)", () => {
    expect(matchZone(zones, { cp: "1414", province: "CABA" })?.id).toBe("z-amba");
  });
  it("matchea por provincia si el CP no entra en un rango anterior", () => {
    expect(matchZone(zones, { cp: "7000", province: "Buenos Aires" })?.id).toBe("z-ba");
  });
  it("cae al rango catch-all", () => {
    expect(matchZone(zones, { cp: "5000", province: "Córdoba" })?.id).toBe("z-resto");
  });
  it("ignora zonas inactivas", () => {
    const inactive: Zone[] = [{ ...zones[0], active: false }];
    expect(matchZone(inactive, { cp: "1414", province: "CABA" })).toBeNull();
  });
  it("null si nada matchea", () => {
    expect(matchZone([zones[1]], { cp: "1414", province: "CABA" })).toBeNull();
  });
});

describe("isFreeShipping", () => {
  it("true si subtotal ≥ umbral", () => {
    expect(isFreeShipping(47500, 47500)).toBe(true);
    expect(isFreeShipping(50000, 47500)).toBe(true);
    expect(isFreeShipping(47499, 47500)).toBe(false);
  });
  it("umbral 0 → nunca gratis por umbral", () => {
    expect(isFreeShipping(100, 0)).toBe(false);
  });
});

describe("methodFactor", () => {
  it("sucursal es más barata que domicilio", () => {
    expect(methodFactor("domicilio")).toBe(1);
    expect(methodFactor("sucursal")).toBeLessThan(1);
  });
});
