import { describe, it, expect } from "vitest";
import { pickQuote, isZipnovaConfigured, type ZipnovaQuoteResponse } from "@/lib/shipping/zipnova";

/** Recorte fiel de una respuesta REAL de POST /v2/shipments/quote (La Plata 1900, 150g). */
const realResponse: ZipnovaQuoteResponse = {
  results: {
    standard_delivery: {
      selectable: true,
      carrier: { name: "OCA" },
      service_type: { id: 1, code: "standard_delivery", name: "Entrega a domicilio" },
      delivery_time: { estimated_delivery: "2026-09-07T23:59:00+00:00" },
      amounts: { price_shipment: 10901.24, price_insurance: 450, price: 11351.24, price_incl_tax: 13735 },
    },
    pickup_point: {
      selectable: true,
      carrier: { name: "Correo Argentino" },
      service_type: { id: 9, code: "pickup_point", name: "Entrega en punto de entrega" },
      delivery_time: { estimated_delivery: "2026-09-02T23:59:00+00:00" },
      amounts: { price_shipment: 9365.7, price_insurance: 450, price: 9815.7, price_incl_tax: 11877 },
    },
  } as ZipnovaQuoteResponse["results"],
};

describe("pickQuote", () => {
  it("domicilio toma standard_delivery con el precio CON impuestos", () => {
    expect(pickQuote(realResponse, "domicilio")).toEqual({
      cost: 13735, // price_incl_tax, no price (11351.24)
      carrier: "OCA",
      estimatedDelivery: "2026-09-07T23:59:00+00:00",
    });
  });

  it("sucursal toma pickup_point, que puede ganarle a domicilio en precio y plazo", () => {
    expect(pickQuote(realResponse, "sucursal")).toEqual({
      cost: 11877,
      carrier: "Correo Argentino",
      estimatedDelivery: "2026-09-02T23:59:00+00:00",
    });
  });

  it("null si el servicio pedido no vino en la respuesta", () => {
    expect(pickQuote({ results: { standard_delivery: realResponse.results!.standard_delivery } }, "sucursal")).toBeNull();
  });

  it("null si la opción vino marcada como no seleccionable", () => {
    const res = { results: { standard_delivery: { ...realResponse.results!.standard_delivery, selectable: false } } };
    expect(pickQuote(res as ZipnovaQuoteResponse, "domicilio")).toBeNull();
  });

  it("null ante respuesta vacía o sin precio usable", () => {
    expect(pickQuote({}, "domicilio")).toBeNull();
    expect(pickQuote({ results: {} }, "domicilio")).toBeNull();
    expect(pickQuote({ results: { standard_delivery: { amounts: {} } } }, "domicilio")).toBeNull();
    expect(pickQuote({ results: { standard_delivery: { amounts: { price_incl_tax: 0 } } } }, "domicilio")).toBeNull();
  });

  it("carrier vacío si la API no lo informa, pero la cotización sigue sirviendo", () => {
    const res: ZipnovaQuoteResponse = { results: { standard_delivery: { amounts: { price_incl_tax: 5000 } } } };
    expect(pickQuote(res, "domicilio")).toEqual({ cost: 5000, carrier: "", estimatedDelivery: null });
  });
});

describe("isZipnovaConfigured", () => {
  it("exige las tres credenciales", () => {
    expect(isZipnovaConfigured({ ZIPNOVA_API_KEY: "k", ZIPNOVA_API_SECRET: "s", ZIPNOVA_ACCOUNT_ID: "1" })).toBe(true);
    expect(isZipnovaConfigured({ ZIPNOVA_API_SECRET: "s", ZIPNOVA_ACCOUNT_ID: "1" })).toBe(false);
    expect(isZipnovaConfigured({ ZIPNOVA_API_KEY: "k", ZIPNOVA_ACCOUNT_ID: "1" })).toBe(false);
    expect(isZipnovaConfigured({ ZIPNOVA_API_KEY: "k", ZIPNOVA_API_SECRET: "s" })).toBe(false);
  });
});
