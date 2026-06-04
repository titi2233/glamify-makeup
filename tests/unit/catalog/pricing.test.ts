import { describe, it, expect } from "vitest";
import {
  toNumber,
  getEffectivePrice,
  isOnSale,
  getDiscountPercent,
} from "@/lib/catalog/pricing";

describe("toNumber", () => {
  it("convierte Decimal-string y number", () => {
    expect(toNumber("1500.00")).toBe(1500);
    expect(toNumber(999.9)).toBe(999.9);
  });
  it("null/undefined → 0", () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
  });
  it("inválido lanza", () => {
    expect(() => toNumber("abc")).toThrow(/Monto inválido/);
  });
});

describe("getEffectivePrice", () => {
  it("usa basePrice si la variante no tiene override", () => {
    expect(getEffectivePrice({ basePrice: "1000" })).toBe(1000);
    expect(getEffectivePrice({ basePrice: "1000" }, { priceOverride: null })).toBe(1000);
  });
  it("usa priceOverride de la variante si existe", () => {
    expect(getEffectivePrice({ basePrice: "1000" }, { priceOverride: "1200" })).toBe(1200);
  });
});

describe("isOnSale / getDiscountPercent", () => {
  it("oferta solo si compareAtPrice > basePrice", () => {
    expect(isOnSale({ basePrice: "1000", compareAtPrice: "1500" })).toBe(true);
    expect(isOnSale({ basePrice: "1000", compareAtPrice: "1000" })).toBe(false);
    expect(isOnSale({ basePrice: "1000", compareAtPrice: null })).toBe(false);
    expect(isOnSale({ basePrice: "1000" })).toBe(false);
  });
  it("descuento redondeado", () => {
    expect(getDiscountPercent({ basePrice: "750", compareAtPrice: "1000" })).toBe(25);
    expect(getDiscountPercent({ basePrice: "1000" })).toBe(0);
  });
});
