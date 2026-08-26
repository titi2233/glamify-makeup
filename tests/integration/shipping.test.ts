import { describe, it, expect } from "vitest";
import { isZipnovaConfigured } from "@/lib/shipping/zipnova";
import { quoteShipping } from "@/lib/shipping/index";
import type { Zone } from "@/lib/shipping/quote";
import type { CartLine } from "@/lib/cart/types";

const line = (over: Partial<CartLine> = {}): CartLine => ({ id: "l1", kind: "variant", refId: "v1", unitPrice: 1000, qty: 1, weightGr: 50, ...over });
const zones: Zone[] = [
  { id: "z-amba", matchType: "cpRange", provinces: [], cpFrom: "1000", cpTo: "1900", price: 2500, active: true, order: 0 },
  { id: "z-resto", matchType: "cpRange", provinces: [], cpFrom: "0", cpTo: "9999", price: 6200, active: true, order: 3 },
];

describe("isZipnovaConfigured", () => {
  it("false si faltan credenciales", () => {
    expect(isZipnovaConfigured({})).toBe(false);
    expect(isZipnovaConfigured({ ZIPNOVA_API_KEY: "k", ZIPNOVA_API_SECRET: "s" })).toBe(false);
    expect(isZipnovaConfigured({ ZIPNOVA_API_KEY: "k", ZIPNOVA_API_SECRET: "s", ZIPNOVA_ACCOUNT_ID: "1" })).toBe(true);
  });
});

describe("quoteShipping", () => {
  const deps = { getZones: async () => zones, getThreshold: async () => 47500, liveQuote: async () => null };
  const base = { cp: "1414", province: "CABA", city: "CABA", lines: [line()], subtotal: 3000 };

  it("envío gratis si supera el umbral", async () => {
    const q = await quoteShipping({ ...base, method: "domicilio", lines: [line({ unitPrice: 50000 })], subtotal: 50000 }, deps);
    expect(q).toMatchObject({ cost: 0, free: true, source: "free" });
  });
  it("usa la zona cuando Zipnova no cotiza", async () => {
    const q = await quoteShipping({ ...base, method: "domicilio" }, deps);
    expect(q).toMatchObject({ cost: 2500, free: false, source: "zone", zoneId: "z-amba" });
  });
  it("en el fallback de zonas, sucursal sigue siendo más barata (methodFactor 0.85)", async () => {
    const q = await quoteShipping({ ...base, method: "sucursal" }, deps);
    expect(q.cost).toBe(2125); // 2500 * 0.85
  });
  it("prefiere la cotización en vivo y expone operador y fecha estimada", async () => {
    const q = await quoteShipping(
      { ...base, method: "domicilio" },
      { ...deps, liveQuote: async () => ({ cost: 13735, carrier: "OCA", estimatedDelivery: "2026-09-07T23:59:00+00:00" }) },
    );
    expect(q).toMatchObject({ cost: 13735, source: "zipnova", carrier: "OCA", estimatedDelivery: "2026-09-07T23:59:00+00:00" });
  });
  it("NO aplica methodFactor sobre la cotización en vivo (Zipnova ya cotiza sucursal aparte)", async () => {
    const q = await quoteShipping(
      { ...base, method: "sucursal" },
      { ...deps, liveQuote: async () => ({ cost: 11877, carrier: "Correo Argentino", estimatedDelivery: null }) },
    );
    expect(q.cost).toBe(11877); // no 11877 * 0.85
  });
  it("pasa localidad y provincia a la cotización en vivo (la API las exige juntas)", async () => {
    let seen: { localidad: string; provincia: string } | null = null;
    await quoteShipping(
      { ...base, city: "La Plata", province: "Buenos Aires", method: "domicilio" },
      { ...deps, liveQuote: async (i) => { seen = { localidad: i.localidad, provincia: i.provincia }; return null; } },
    );
    expect(seen).toEqual({ localidad: "La Plata", provincia: "Buenos Aires" });
  });
  it("sin zona ni cotización en vivo → source none, cost 0", async () => {
    const q = await quoteShipping({ ...base, method: "domicilio" }, { ...deps, getZones: async () => [] });
    expect(q).toMatchObject({ source: "none", cost: 0 });
  });
});
