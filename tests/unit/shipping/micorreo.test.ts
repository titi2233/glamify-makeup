import { describe, it, expect, beforeEach } from "vitest";
import {
  pickRate,
  isMicorreoConfigured,
  quoteMicorreo,
  __resetMicorreoAuthCache,
  type MicorreoRatesResponse,
  type MicorreoEnv,
} from "@/lib/shipping/micorreo";

/** Recorte fiel de una respuesta de POST /micorreo/v1/rates (dos productos: Clásico y Expreso). */
const ratesResponse: MicorreoRatesResponse = {
  rates: [
    { productType: "CP", productName: "PAQAR CLASICO", price: 6113, deliveryTimeMax: 5 },
    { productType: "EP", productName: "PAQAR EXPRESO", price: 8410, deliveryTimeMax: 3 },
  ],
};

describe("pickRate", () => {
  it("Clásico (CP) toma la tarifa CP", () => {
    expect(pickRate(ratesResponse, "CP")).toEqual({ cost: 6113, carrier: "Correo Argentino", estimatedDelivery: null });
  });
  it("Expreso (EP) toma la tarifa EP", () => {
    expect(pickRate(ratesResponse, "EP")).toEqual({ cost: 8410, carrier: "Correo Argentino", estimatedDelivery: null });
  });
  it("null si el productType pedido no vino", () => {
    expect(pickRate({ rates: [{ productType: "EP", price: 8410 }] }, "CP")).toBeNull();
  });
  it("null ante respuesta vacía o precio no usable", () => {
    expect(pickRate({}, "CP")).toBeNull();
    expect(pickRate({ rates: [] }, "CP")).toBeNull();
    expect(pickRate({ rates: [{ productType: "CP", price: 0 }] }, "CP")).toBeNull();
    expect(pickRate({ rates: [{ productType: "CP" }] }, "CP")).toBeNull();
  });
});

describe("isMicorreoConfigured", () => {
  it("exige email, password y gateway auth", () => {
    expect(isMicorreoConfigured({ MICORREO_EMAIL: "e", MICORREO_PASSWORD: "p", MICORREO_GATEWAY_AUTH: "g" })).toBe(true);
    expect(isMicorreoConfigured({ MICORREO_PASSWORD: "p", MICORREO_GATEWAY_AUTH: "g" })).toBe(false);
    expect(isMicorreoConfigured({ MICORREO_EMAIL: "e", MICORREO_GATEWAY_AUTH: "g" })).toBe(false);
    expect(isMicorreoConfigured({ MICORREO_EMAIL: "e", MICORREO_PASSWORD: "p" })).toBe(false);
  });
});

const env: MicorreoEnv = { MICORREO_EMAIL: "e@x.com", MICORREO_PASSWORD: "pw", MICORREO_GATEWAY_AUTH: "GATEWAY" };
const jsonRes = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

describe("quoteMicorreo (flujo completo con fetch fake)", () => {
  beforeEach(() => __resetMicorreoAuthCache());

  it("hace token → validate → rates y devuelve la tarifa Clásico por defecto", async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      calls.push({ url, body });
      if (url.endsWith("/token")) return jsonRes({ token: "JWT", expire: "2099-01-01T00:00:00Z" });
      if (url.endsWith("/users/validate")) return jsonRes({ customerId: 12345 });
      if (url.endsWith("/rates")) return jsonRes(ratesResponse);
      throw new Error("url inesperada " + url);
    }) as unknown as typeof fetch;

    const q = await quoteMicorreo({ cpDestino: "1900", pesoGr: 500, metodo: "sucursal" }, env, fakeFetch, 1000);
    expect(q).toEqual({ cost: 6113, carrier: "Correo Argentino", estimatedDelivery: null });

    const rates = calls.find((c) => c.url.endsWith("/rates"))!;
    expect(rates.body).toMatchObject({
      customerId: "12345",
      postalCodeOrigin: "6700",
      postalCodeDestination: "1900",
      deliveredType: "S", // sucursal
      dimensions: { weight: 0.5, length: 12, width: 5, height: 5 }, // gramos → kg
    });
    // El header Basic usa el gateway; /rates usa Bearer del token.
    expect(calls.find((c) => c.url.endsWith("/token"))).toBeTruthy();
  });

  it("domicilio manda deliveredType D; express toma EP", async () => {
    const fakeFetch = (async (url: string) => {
      if (url.endsWith("/token")) return jsonRes({ token: "JWT", expire: "2099-01-01T00:00:00Z" });
      if (url.endsWith("/users/validate")) return jsonRes({ customerId: 1 });
      return jsonRes(ratesResponse);
    }) as unknown as typeof fetch;

    const q = await quoteMicorreo(
      { cpDestino: "5000", pesoGr: 500, metodo: "domicilio" },
      { ...env, MICORREO_VELOCITY: "express" },
      fakeFetch,
      1000,
    );
    expect(q).toEqual({ cost: 8410, carrier: "Correo Argentino", estimatedDelivery: null });
  });

  it("cachea el auth: una segunda cotización no vuelve a pedir token ni validate", async () => {
    let tokenCalls = 0;
    const fakeFetch = (async (url: string) => {
      if (url.endsWith("/token")) { tokenCalls++; return jsonRes({ token: "JWT", expire: "2099-01-01T00:00:00Z" }); }
      if (url.endsWith("/users/validate")) return jsonRes({ customerId: 1 });
      return jsonRes(ratesResponse);
    }) as unknown as typeof fetch;

    await quoteMicorreo({ cpDestino: "1900", pesoGr: 500, metodo: "sucursal" }, env, fakeFetch, 1000);
    await quoteMicorreo({ cpDestino: "5000", pesoGr: 500, metodo: "sucursal" }, env, fakeFetch, 2000);
    expect(tokenCalls).toBe(1);
  });

  it("null si falta config, sin tocar la red", async () => {
    let called = false;
    const fakeFetch = (async () => { called = true; return jsonRes({}); }) as unknown as typeof fetch;
    const q = await quoteMicorreo({ cpDestino: "1900", pesoGr: 500, metodo: "sucursal" }, {}, fakeFetch, 1000);
    expect(q).toBeNull();
    expect(called).toBe(false);
  });

  it("null si /token falla (cae a zonas, no rompe)", async () => {
    const fakeFetch = (async (url: string) => {
      if (url.endsWith("/token")) return jsonRes({}, false);
      return jsonRes(ratesResponse);
    }) as unknown as typeof fetch;
    const q = await quoteMicorreo({ cpDestino: "1900", pesoGr: 500, metodo: "sucursal" }, env, fakeFetch, 1000);
    expect(q).toBeNull();
  });
});
