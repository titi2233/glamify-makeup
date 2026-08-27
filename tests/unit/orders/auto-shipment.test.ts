import { describe, it, expect, vi } from "vitest";
import { buildImportInput, autoImportShipment, type AutoShipmentOrder } from "@/lib/orders/auto-shipment";
import type { MicorreoEnv, MicorreoShipmentResult } from "@/lib/shipping/micorreo";

const baseOrder = (over: Partial<AutoShipmentOrder> = {}): AutoShipmentOrder => ({
  orderNumber: "GLM-000123",
  contactName: "Maria Gonzalez",
  contactEmail: "maria@mail.com",
  contactPhone: "1144556677",
  shippingMethod: "domicilio",
  shippingAddress: { cp: "1900", province: "Buenos Aires", street: "Calle 50", number: "123", city: "La Plata" },
  weightGr: 120,
  declaredValue: 30000,
  ...over,
});

describe("buildImportInput", () => {
  it("domicilio: mapea address del checkout al input de MiCorreo", () => {
    const r = buildImportInput(baseOrder());
    expect(r).toEqual({
      input: {
        extOrderId: "GLM-000123",
        recipient: { name: "Maria Gonzalez", email: "maria@mail.com", phone: "1144556677" },
        metodo: "domicilio",
        pesoGr: 120,
        valorDeclarado: 30000,
        address: { streetName: "Calle 50", streetNumber: "123", city: "La Plata", province: "Buenos Aires", postalCode: "1900" },
      },
    });
  });

  it("sucursal con agencyCode: arma input con agency (sin address)", () => {
    const r = buildImportInput(baseOrder({
      shippingMethod: "sucursal",
      shippingAddress: { cp: "1900", province: "Buenos Aires", city: "La Plata", agencyCode: "B0200" },
    }));
    expect(r).toEqual({
      input: {
        extOrderId: "GLM-000123",
        recipient: { name: "Maria Gonzalez", email: "maria@mail.com", phone: "1144556677" },
        metodo: "sucursal",
        pesoGr: 120,
        valorDeclarado: 30000,
        agency: "B0200",
      },
    });
  });

  it("sucursal SIN agencyCode (pedido viejo): skip → carga manual", () => {
    expect(buildImportInput(baseOrder({ shippingMethod: "sucursal", shippingAddress: { cp: "1900", city: "La Plata" } }))).toEqual({
      skip: expect.stringContaining("sucursal"),
    });
  });

  it("dirección incompleta: skip", () => {
    expect(buildImportInput(baseOrder({ shippingAddress: { cp: "1900", province: "Buenos Aires", street: "Calle 50" } }))).toEqual({
      skip: expect.stringContaining("incompleta"),
    });
    expect(buildImportInput(baseOrder({ shippingAddress: null }))).toEqual({ skip: expect.stringContaining("incompleta") });
  });
});

describe("autoImportShipment", () => {
  const env: MicorreoEnv = { MICORREO_VELOCITY: "classic" };
  const okFn = vi.fn(async (): Promise<MicorreoShipmentResult> => ({ ok: true, createdAt: "2026-08-27T10:00:00Z" }));

  it("importa y devuelve el service según la velocidad", async () => {
    const r = await autoImportShipment(baseOrder(), okFn, env);
    expect(r).toEqual({ imported: true, service: "Correo Argentino Clásico", detail: expect.stringContaining("importado") });
    expect(okFn).toHaveBeenCalledOnce();
  });

  it("velocidad express → service Expreso", async () => {
    const r = await autoImportShipment(baseOrder(), okFn, { MICORREO_VELOCITY: "express" });
    expect(r).toMatchObject({ imported: true, service: "Correo Argentino Expreso" });
  });

  it("sucursal → no llama a la API, imported:false", async () => {
    const spy = vi.fn(async (): Promise<MicorreoShipmentResult> => ({ ok: true, createdAt: null }));
    const r = await autoImportShipment(baseOrder({ shippingMethod: "sucursal" }), spy, env);
    expect(r.imported).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it("'ya fue importada' se trata como éxito idempotente", async () => {
    const dupFn = vi.fn(async (): Promise<MicorreoShipmentResult> => ({ ok: false, error: "La orden ya fue importada con anterioridad" }));
    const r = await autoImportShipment(baseOrder(), dupFn, env);
    expect(r).toMatchObject({ imported: true, service: "Correo Argentino Clásico" });
  });

  it("otro error → imported:false con el motivo", async () => {
    const errFn = vi.fn(async (): Promise<MicorreoShipmentResult> => ({ ok: false, error: "No pude conectarme con MiCorreo." }));
    const r = await autoImportShipment(baseOrder(), errFn, env);
    expect(r).toEqual({ imported: false, detail: "No pude conectarme con MiCorreo." });
  });
});
