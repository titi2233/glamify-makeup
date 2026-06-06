import { describe, it, expect, vi } from "vitest";
import { createRetractionRequest } from "@/lib/legal/retraction/service";

function makeDeps(seq = 7) {
  const create = vi.fn().mockResolvedValue({ seq });
  const sendEmail = vi.fn().mockResolvedValue({ id: null, logged: true });
  return { db: { retractionRequest: { create } }, sendEmail, ownerEmail: "owner@glamify.test", create };
}

describe("createRetractionRequest", () => {
  it("rechaza input inválido sin tocar DB", async () => {
    const d = makeDeps();
    const r = await createRetractionRequest({ contactName: "A", contactEmail: "x" }, d);
    expect(r.ok).toBe(false);
    expect(d.create).not.toHaveBeenCalled();
  });

  it("crea registro, devuelve constancia y notifica a la dueña", async () => {
    const d = makeDeps(7);
    const r = await createRetractionRequest(
      { contactName: "Ana Pérez", contactEmail: "ana@mail.com", website: "" },
      d,
    );
    expect(r).toEqual({ ok: true, ticket: "ARR-000007" });
    expect(d.create).toHaveBeenCalledWith({
      data: { contactName: "Ana Pérez", contactEmail: "ana@mail.com", contactPhone: null, orderNumber: null, reason: null },
      select: { seq: true },
    });
    expect(d.sendEmail).toHaveBeenCalledOnce();
    expect(d.sendEmail.mock.calls[0][0].to).toBe("owner@glamify.test");
    expect(d.sendEmail.mock.calls[0][0].subject).toContain("ARR-000007");
  });

  it("no falla la solicitud si el email a la dueña tira error", async () => {
    const d = makeDeps(8);
    d.sendEmail.mockRejectedValueOnce(new Error("resend down"));
    const r = await createRetractionRequest({ contactName: "Ana Pérez", contactEmail: "ana@mail.com" }, d);
    expect(r.ok).toBe(true);
  });

  it("no envía email si no hay ownerEmail", async () => {
    const d = makeDeps(9);
    d.ownerEmail = "";
    await createRetractionRequest({ contactName: "Ana Pérez", contactEmail: "ana@mail.com" }, d);
    expect(d.sendEmail).not.toHaveBeenCalled();
  });
});
