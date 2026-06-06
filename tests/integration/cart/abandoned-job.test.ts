import { describe, it, expect, vi } from "vitest";
import { runAbandonedCartJob, type AbandonedJobDb } from "@/lib/cart/abandoned-job";

const old = new Date("2026-06-05T11:00:00Z");

function makeDb() {
  const update = vi.fn(async () => ({}));
  const db = {
    cart: {
      findMany: vi.fn(async () => [
        {
          id: "c1", updatedAt: old, abandonedEmailSentAt: null, contactEmail: "guest@x.com", recoveryEmailConsent: true,
          customer: null,
          items: [{ qty: 2, unitPriceSnapshot: 4500, variant: { product: { name: "Labial" }, name: "Rojo" }, combo: null }],
        },
      ]),
      update,
    },
  } as unknown as AbandonedJobDb;
  return { db, update };
}

describe("runAbandonedCartJob", () => {
  it("envía el email y estampa abandonedEmailSentAt", async () => {
    const { db, update } = makeDb();
    const sendEmail = vi.fn(async () => ({ id: "e1", logged: false }));
    const res = await runAbandonedCartJob({ db, sendEmail, now: new Date("2026-06-06T12:00:00Z"), appUrl: "http://localhost:3000" });
    expect(res.sent).toBe(1);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "guest@x.com" }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "c1" } }));
  });

  it("no envía si no hay consentimiento", async () => {
    const { db } = makeDb();
    (db.cart.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: "c2", updatedAt: old, abandonedEmailSentAt: null, contactEmail: "x@x.com", recoveryEmailConsent: false, customer: null, items: [{ qty: 1, unitPriceSnapshot: 1000, variant: { product: { name: "X" }, name: "U" }, combo: null }] },
    ]);
    const sendEmail = vi.fn(async () => ({ id: null, logged: true }));
    const res = await runAbandonedCartJob({ db, sendEmail, now: new Date("2026-06-06T12:00:00Z"), appUrl: "http://localhost:3000" });
    expect(res.sent).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
