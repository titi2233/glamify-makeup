import { describe, it, expect, beforeEach } from "vitest";
import {
  pickRate,
  pickAgency,
  isMicorreoConfigured,
  quoteMicorreo,
  getMicorreoAgencies,
  provinceCode,
  createMicorreoShipment,
  __resetMicorreoAuthCache,
  type MicorreoRatesResponse,
  type MicorreoEnv,
  type MicorreoShipmentInput,
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
      dimensions: { weight: 500, length: 12, width: 5, height: 5 }, // gramos enteros (la API los exige en [g])
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

describe("provinceCode", () => {
  it("mapea nombres exactos", () => {
    expect(provinceCode("Buenos Aires")).toBe("B");
    expect(provinceCode("CORDOBA")).toBe("X");
    expect(provinceCode("Tierra del Fuego")).toBe("V");
  });
  it("tolera acentos, minúsculas y espacios de más", () => {
    expect(provinceCode("Córdoba")).toBe("X");
    expect(provinceCode("  entre  ríos ")).toBe("E");
    expect(provinceCode("Neuquén")).toBe("Q");
    expect(provinceCode("Tucumán")).toBe("T");
  });
  it("CABA en sus variantes", () => {
    expect(provinceCode("CABA")).toBe("C");
    expect(provinceCode("Capital Federal")).toBe("C");
  });
  it("null si no la reconoce", () => {
    expect(provinceCode("Montevideo")).toBeNull();
    expect(provinceCode("")).toBeNull();
    expect(provinceCode(null)).toBeNull();
  });
});

describe("createMicorreoShipment", () => {
  beforeEach(() => __resetMicorreoAuthCache());

  const baseInput: MicorreoShipmentInput = {
    extOrderId: "GLM-000123",
    recipient: { name: "Maria Gonzalez", email: "maria@mail.com", phone: "1144556677" },
    metodo: "domicilio",
    pesoGr: 500,
    valorDeclarado: 30000,
    address: {
      streetName: "Av. Corrientes",
      streetNumber: "1234",
      city: "La Plata",
      province: "Buenos Aires",
      postalCode: "1900",
    },
  };

  /** Responde las dos llamadas de auth; null si la url no es de auth. */
  const authOk = (url: string) => {
    if (url.endsWith("/token")) return jsonRes({ token: "JWT", expire: "2099-01-01T00:00:00Z" });
    if (url.endsWith("/users/validate")) return jsonRes({ customerId: 999 });
    return null;
  };

  it("domicilio: manda deliveryType D con provinceCode traducido y peso en gramos", async () => {
    let sent: Record<string, unknown> | null = null;
    const fakeFetch = (async (url: string, init: RequestInit) => {
      const pre = authOk(url);
      if (pre) return pre;
      sent = JSON.parse(init.body as string);
      return jsonRes({ createdAt: "2026-08-27T10:00:00Z" });
    }) as unknown as typeof fetch;

    const r = await createMicorreoShipment(baseInput, env, fakeFetch, 1000);
    expect(r).toEqual({ ok: true, createdAt: "2026-08-27T10:00:00Z" });
    expect(sent).toMatchObject({
      customerId: "999",
      extOrderId: "GLM-000123",
      recipient: { name: "Maria Gonzalez", email: "maria@mail.com", phone: "1144556677" },
      shipping: {
        deliveryType: "D",
        address: {
          streetName: "Av. Corrientes",
          streetNumber: "1234",
          city: "La Plata",
          provinceCode: "B",
          postalCode: "1900",
        },
        weight: 500, // gramos, NO kg (a diferencia de /rates)
        declaredValue: 30000,
      },
    });
  });

  it("sucursal sin agencia: error claro, sin tocar la red", async () => {
    let called = false;
    const fakeFetch = (async () => {
      called = true;
      return jsonRes({});
    }) as unknown as typeof fetch;
    const r = await createMicorreoShipment({ ...baseInput, metodo: "sucursal", agency: null }, env, fakeFetch, 1000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/sucursal/i);
    expect(called).toBe(false);
  });

  it("sucursal con agencia: manda deliveryType S y el código, sin address", async () => {
    let sent: { shipping: Record<string, unknown> } | null = null;
    const fakeFetch = (async (url: string, init: RequestInit) => {
      const pre = authOk(url);
      if (pre) return pre;
      sent = JSON.parse(init.body as string);
      return jsonRes({ createdAt: "2026-08-27T10:00:00Z" });
    }) as unknown as typeof fetch;

    const r = await createMicorreoShipment({ ...baseInput, metodo: "sucursal", agency: "0021" }, env, fakeFetch, 1000);
    expect(r.ok).toBe(true);
    expect(sent!.shipping).toMatchObject({ deliveryType: "S", agency: "0021" });
    expect(sent!.shipping.address).toBeUndefined();
  });

  it("dirección incompleta o provincia desconocida: error claro sin llamar a la API", async () => {
    let called = false;
    const fakeFetch = (async () => {
      called = true;
      return jsonRes({});
    }) as unknown as typeof fetch;

    const sinCalle = await createMicorreoShipment(
      { ...baseInput, address: { ...baseInput.address!, streetName: "" } },
      env,
      fakeFetch,
      1000,
    );
    expect(sinCalle.ok).toBe(false);

    const provMala = await createMicorreoShipment(
      { ...baseInput, address: { ...baseInput.address!, province: "Montevideo" } },
      env,
      fakeFetch,
      1000,
    );
    expect(provMala.ok).toBe(false);
    if (!provMala.ok) expect(provMala.error).toMatch(/Montevideo/);
    expect(called).toBe(false);
  });

  it("propaga el mensaje de error de MiCorreo (ej. orden ya importada)", async () => {
    const fakeFetch = (async (url: string) => {
      const pre = authOk(url);
      if (pre) return pre;
      return {
        ok: false,
        status: 400,
        json: async () => ({ message: "La orden ya fue importada con anterioridad" }),
      } as Response;
    }) as unknown as typeof fetch;

    const r = await createMicorreoShipment(baseInput, env, fakeFetch, 1000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("La orden ya fue importada con anterioridad");
  });

  it("sin credenciales: error claro, sin red", async () => {
    let called = false;
    const fakeFetch = (async () => {
      called = true;
      return jsonRes({});
    }) as unknown as typeof fetch;
    const r = await createMicorreoShipment(baseInput, {}, fakeFetch, 1000);
    expect(r.ok).toBe(false);
    expect(called).toBe(false);
  });
});

describe("pickAgency", () => {
  it("normaliza la fila anidada real de /agencies", () => {
    const row = {
      code: "B0200",
      name: "LA PLATA",
      services: { packageReception: true },
      location: { address: { streetName: "AV 51", streetNumber: "456", locality: "LA PLATA", city: "LA PLATA" } },
    };
    expect(pickAgency(row)).toEqual({ code: "B0200", label: "LA PLATA · AV 51 456 · LA PLATA", locality: "LA PLATA" });
  });
  it("null si no hay código", () => {
    expect(pickAgency({ name: "X" })).toBeNull();
  });
  it("label cae al código si no hay nombre ni dirección", () => {
    expect(pickAgency({ code: "B9999" })).toEqual({ code: "B9999", label: "B9999", locality: "" });
  });
});

describe("getMicorreoAgencies", () => {
  beforeEach(() => __resetMicorreoAuthCache());
  const agEnv: MicorreoEnv = { MICORREO_EMAIL: "e", MICORREO_PASSWORD: "p", MICORREO_GATEWAY_AUTH: "g" };
  const rows = [
    { code: "B0200", name: "LA PLATA", services: { packageReception: true }, location: { address: { locality: "LA PLATA" } } },
    { code: "B0300", name: "BERISSO", services: { packageReception: true }, location: { address: { locality: "BERISSO" } } },
    { code: "B0400", name: "NO RECIBE", services: { packageReception: false }, location: { address: { locality: "LA PLATA" } } },
  ];
  const fakeFetch = (async (url: string) => {
    if (url.endsWith("/token")) return { ok: true, json: async () => ({ token: "JWT", expire: "2099-01-01T00:00:00Z" }) } as Response;
    if (url.endsWith("/users/validate")) return { ok: true, json: async () => ({ customerId: 1 }) } as Response;
    if (url.includes("/agencies")) return { ok: true, json: async () => rows } as Response;
    throw new Error("url inesperada " + url);
  }) as unknown as typeof fetch;

  it("filtra por localidad y excluye las que no reciben paquetes", async () => {
    const list = await getMicorreoAgencies("B", "la plata", agEnv, fakeFetch, 1000);
    expect(list).toEqual([{ code: "B0200", label: "LA PLATA · LA PLATA", locality: "LA PLATA" }]);
  });
  it("sin filtro de localidad devuelve todas las que reciben (acento-insensible)", async () => {
    const list = await getMicorreoAgencies("B", null, agEnv, fakeFetch, 1000);
    expect(list.map((a) => a.code)).toEqual(["B0200", "B0300"]);
  });
  it("[] sin credenciales, sin tocar la red", async () => {
    let called = false;
    const spy = (async () => { called = true; return {} as Response; }) as unknown as typeof fetch;
    expect(await getMicorreoAgencies("B", null, {}, spy, 1000)).toEqual([]);
    expect(called).toBe(false);
  });
  it("[] si /agencies falla", async () => {
    const failFetch = (async (url: string) => {
      if (url.endsWith("/token")) return { ok: true, json: async () => ({ token: "JWT", expire: "2099-01-01T00:00:00Z" }) } as Response;
      if (url.endsWith("/users/validate")) return { ok: true, json: async () => ({ customerId: 1 }) } as Response;
      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;
    expect(await getMicorreoAgencies("B", null, agEnv, failFetch, 1000)).toEqual([]);
  });
});
