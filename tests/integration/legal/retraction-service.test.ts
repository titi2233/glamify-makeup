import { describe, it, expect, vi } from "vitest";
import { createRetractionRequest } from "@/lib/legal/retraction/service";

const CREATED_AT = new Date("2026-06-06T18:00:00Z");

function makeDeps(seq = 7) {
  const create = vi.fn().mockResolvedValue({ seq, createdAt: CREATED_AT });
  const sendEmail = vi.fn().mockResolvedValue({ id: null, logged: true });
  return { db: { retractionRequest: { create } }, sendEmail, ownerEmail: "owner@glamify.test", create };
}

describe("createRetractionRequest", () => {
  it("rechaza input inválido sin tocar DB ni enviar emails", async () => {
    const d = makeDeps();
    const r = await createRetractionRequest({ contactName: "A", contactEmail: "x" }, d);
    expect(r.ok).toBe(false);
    expect(d.create).not.toHaveBeenCalled();
    expect(d.sendEmail).not.toHaveBeenCalled();
  });

  it("crea registro, devuelve constancia con fecha, y notifica a la clienta y a la dueña", async () => {
    const d = makeDeps(7);
    const r = await createRetractionRequest(
      { contactName: "Ana Pérez", contactEmail: "ana@mail.com", website: "" },
      d,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ticket).toBe("ARR-000007");
      expect(typeof r.date).toBe("string");
      expect(r.date).toContain("2026");
    }
    expect(d.create).toHaveBeenCalledWith({
      data: { contactName: "Ana Pérez", contactEmail: "ana@mail.com", contactPhone: null, orderNumber: null, reason: null },
      select: { seq: true, createdAt: true },
    });
    // Dos emails: constancia a la clienta + alerta a la dueña.
    expect(d.sendEmail).toHaveBeenCalledTimes(2);
    const recipients = d.sendEmail.mock.calls.map((c) => c[0].to);
    expect(recipients).toContain("ana@mail.com");
    expect(recipients).toContain("owner@glamify.test");
  });

  it("envía la constancia a la clienta aunque no haya ownerEmail", async () => {
    const d = makeDeps(9);
    d.ownerEmail = "";
    await createRetractionRequest({ contactName: "Ana Pérez", contactEmail: "ana@mail.com" }, d);
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    expect(d.sendEmail.mock.calls[0][0].to).toBe("ana@mail.com");
  });

  it("no falla la solicitud si el envío de email tira error", async () => {
    const d = makeDeps(8);
    d.sendEmail.mockRejectedValue(new Error("resend down"));
    const r = await createRetractionRequest({ contactName: "Ana Pérez", contactEmail: "ana@mail.com" }, d);
    expect(r.ok).toBe(true);
  });
});
