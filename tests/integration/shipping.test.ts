import { describe, it, expect, vi } from "vitest";
import { isCorreoConfigured } from "@/lib/shipping/correo";
import { quoteShipping } from "@/lib/shipping/index";
import type { Zone } from "@/lib/shipping/quote";
import type { CartLine } from "@/lib/cart/types";

const line = (over: Partial<CartLine> = {}): CartLine => ({ id: "l1", kind: "variant", refId: "v1", unitPrice: 1000, qty: 1, weightGr: 50, ...over });
const zones: Zone[] = [
  { id: "z-amba", matchType: "cpRange", provinces: [], cpFrom: "1000", cpTo: "1900", price: 2500, active: true, order: 0 },
  { id: "z-resto", matchType: "cpRange", provinces: [], cpFrom: "0", cpTo: "9999", price: 6200, active: true, order: 3 },
];

describe("isCorreoConfigured", () => {
  it("false si faltan credenciales", () => {
    expect(isCorreoConfigured({})).toBe(false);
    expect(isCorreoConfigured({ MICORREO_USER: "u", MICORREO_PASSWORD: "p", MICORREO_AGREEMENT: "a" })).toBe(true);
  });
});

describe("quoteShipping", () => {
  const deps = { getZones: async () => zones, getThreshold: async () => 47500, correoQuote: async () => null };

  it("envío gratis si supera el umbral", async () => {
    const q = await quoteShipping({ cp: "1414", province: "CABA", method: "domicilio", lines: [line({ unitPrice: 50000 })], subtotal: 50000 }, deps);
    expect(q).toMatchObject({ cost: 0, free: true, source: "free" });
  });
  it("usa la zona cuando Correo no está configurado", async () => {
    const q = await quoteShipping({ cp: "1414", province: "CABA", method: "domicilio", lines: [line()], subtotal: 3000 }, deps);
    expect(q).toMatchObject({ cost: 2500, free: false, source: "zone", zoneId: "z-amba" });
  });
  it("sucursal es más barata (methodFactor 0.85)", async () => {
    const q = await quoteShipping({ cp: "1414", province: "CABA", method: "sucursal", lines: [line()], subtotal: 3000 }, deps);
    expect(q.cost).toBe(2125); // 2500 * 0.85
  });
  it("prefiere Correo cuando devuelve una cotización", async () => {
    const q = await quoteShipping({ cp: "1414", province: "CABA", method: "domicilio", lines: [line()], subtotal: 3000 }, { ...deps, correoQuote: async () => 1999 });
    expect(q).toMatchObject({ cost: 1999, source: "correo" });
  });
  it("sin zona ni Correo → source none, cost 0", async () => {
    const q = await quoteShipping({ cp: "1414", province: "CABA", method: "domicilio", lines: [line()], subtotal: 3000 }, { ...deps, getZones: async () => [] });
    expect(q).toMatchObject({ source: "none", cost: 0 });
  });
});
