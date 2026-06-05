import { describe, it, expect } from "vitest";
import { validateCoupon, applyCoupon, type ValidatableCoupon, type ApplicableCoupon } from "@/lib/coupons/apply";
import type { CartLine } from "@/lib/cart/types";

const baseCoupon = (over: Partial<ValidatableCoupon> = {}): ValidatableCoupon => ({
  active: true, minSubtotal: null, validFrom: null, validTo: null, maxUses: null, usedCount: 0, ...over,
});
const NOW = new Date("2026-06-04T12:00:00Z");

const line = (over: Partial<CartLine> = {}): CartLine => ({
  id: "l1", kind: "variant", refId: "v1", unitPrice: 1000, qty: 1, weightGr: 25, productId: "p1", categoryId: "c1", ...over,
});

describe("validateCoupon", () => {
  it("acepta un cupón activo sin restricciones", () => {
    expect(validateCoupon(baseCoupon(), { subtotal: 5000, now: NOW })).toEqual({ ok: true });
  });
  it("rechaza inactivo", () => {
    expect(validateCoupon(baseCoupon({ active: false }), { subtotal: 5000, now: NOW }).ok).toBe(false);
  });
  it("rechaza fuera de ventana de validez", () => {
    expect(validateCoupon(baseCoupon({ validFrom: new Date("2026-07-01T00:00:00Z") }), { subtotal: 5000, now: NOW }).ok).toBe(false);
    expect(validateCoupon(baseCoupon({ validTo: new Date("2026-05-01T00:00:00Z") }), { subtotal: 5000, now: NOW }).ok).toBe(false);
  });
  it("rechaza si subtotal < minSubtotal", () => {
    expect(validateCoupon(baseCoupon({ minSubtotal: 5000 }), { subtotal: 4999, now: NOW }).ok).toBe(false);
    expect(validateCoupon(baseCoupon({ minSubtotal: 5000 }), { subtotal: 5000, now: NOW }).ok).toBe(true);
  });
  it("rechaza si se agotaron los usos", () => {
    expect(validateCoupon(baseCoupon({ maxUses: 10, usedCount: 10 }), { subtotal: 5000, now: NOW }).ok).toBe(false);
  });
});

describe("applyCoupon", () => {
  const pct = (over: Partial<ApplicableCoupon> = {}): ApplicableCoupon => ({ type: "percentage", value: 10, scope: "all", scopeId: null, ...over });

  it("percentage scope=all sobre todo el subtotal", () => {
    const lines = [line({ unitPrice: 1000, qty: 2 }), line({ id: "l2", unitPrice: 3000, qty: 1 })]; // subtotal 5000
    expect(applyCoupon(pct({ value: 10 }), lines)).toEqual({ discount: 500, freeShipping: false });
  });
  it("fixed scope=all, capeado al subtotal", () => {
    const lines = [line({ unitPrice: 1000, qty: 1 })]; // 1000
    expect(applyCoupon(pct({ type: "fixed", value: 1500 }), lines)).toEqual({ discount: 1000, freeShipping: false });
  });
  it("free_shipping → freeShipping true, sin descuento", () => {
    const lines = [line({ unitPrice: 1000, qty: 1 })];
    expect(applyCoupon(pct({ type: "free_shipping", value: 0 }), lines)).toEqual({ discount: 0, freeShipping: true });
  });
  it("scope=category solo descuenta líneas de esa categoría", () => {
    const lines = [line({ categoryId: "c1", unitPrice: 2000, qty: 1 }), line({ id: "l2", categoryId: "c2", unitPrice: 2000, qty: 1 })];
    expect(applyCoupon(pct({ value: 10, scope: "category", scopeId: "c1" }), lines)).toEqual({ discount: 200, freeShipping: false });
  });
  it("scope=product solo descuenta ese producto", () => {
    const lines = [line({ productId: "p1", unitPrice: 2000, qty: 1 }), line({ id: "l2", productId: "p2", unitPrice: 2000, qty: 1 })];
    expect(applyCoupon(pct({ value: 50, scope: "product", scopeId: "p1" }), lines)).toEqual({ discount: 1000, freeShipping: false });
  });
  it("combos solo matchean scope=all (sin product/category)", () => {
    const lines = [line({ kind: "combo", refId: "combo1", productId: null, categoryId: null, unitPrice: 4990, qty: 1 })];
    expect(applyCoupon(pct({ value: 10, scope: "category", scopeId: "c1" }), lines)).toEqual({ discount: 0, freeShipping: false });
    expect(applyCoupon(pct({ value: 10, scope: "all" }), lines)).toEqual({ discount: 499, freeShipping: false });
  });
});
