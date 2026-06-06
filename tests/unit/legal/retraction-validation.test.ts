import { describe, it, expect } from "vitest";
import { validateRetraction } from "@/lib/legal/retraction/validation";

const ok = { contactName: "Ana Pérez", contactEmail: "ana@mail.com", website: "" };

describe("validateRetraction", () => {
  it("acepta input mínimo válido", () => {
    const r = validateRetraction(ok);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.contactEmail).toBe("ana@mail.com");
  });
  it("normaliza email a minúsculas y recorta", () => {
    const r = validateRetraction({ ...ok, contactEmail: "  ANA@Mail.com " });
    expect(r.ok && r.value.contactEmail).toBe("ana@mail.com");
  });
  it("rechaza email inválido", () => {
    expect(validateRetraction({ ...ok, contactEmail: "nope" }).ok).toBe(false);
  });
  it("rechaza nombre corto", () => {
    expect(validateRetraction({ ...ok, contactName: "A" }).ok).toBe(false);
  });
  it("rechaza honeypot completo (spam)", () => {
    expect(validateRetraction({ ...ok, website: "http://spam" }).ok).toBe(false);
  });
  it("acepta opcionales y los recorta", () => {
    const r = validateRetraction({ ...ok, orderNumber: " GLM-000001 ", contactPhone: " 11 ", reason: " test " });
    expect(r.ok && r.value.orderNumber).toBe("GLM-000001");
  });
  it("convierte opcionales vacíos en null", () => {
    const r = validateRetraction({ ...ok, orderNumber: "   ", contactPhone: "", reason: undefined });
    expect(r.ok && r.value.orderNumber).toBeNull();
    expect(r.ok && r.value.contactPhone).toBeNull();
    expect(r.ok && r.value.reason).toBeNull();
  });
});
