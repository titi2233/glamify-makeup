import { describe, it, expect, vi } from "vitest";
import { runOrderExpiryJob, type ExpiryJobDb } from "@/lib/orders/expiry-job";

const old = new Date("2026-06-05T10:00:00Z"); // >24h
const recent = new Date("2026-06-06T11:30:00Z");

describe("runOrderExpiryJob", () => {
  it("cancela pending_payment con más de 24h", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const db = {
      order: {
        findMany: vi.fn(async () => [
          { id: "o1", status: "pending_payment", createdAt: old },
          { id: "o2", status: "pending_payment", createdAt: recent },
        ]),
      },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({ order: { updateMany } })),
    } as unknown as ExpiryJobDb;

    const res = await runOrderExpiryJob({ db, now: new Date("2026-06-06T12:00:00Z") });
    expect(res.cancelled).toBe(1);
    expect(updateMany).toHaveBeenCalledWith({ where: { id: "o1", status: "pending_payment" }, data: { status: "cancelled" } });
  });

  it("perdió la carrera contra el webhook (el pedido ya no está pending_payment) → no lo cuenta como cancelado", async () => {
    // El findMany trajo o1 como pending_payment, pero entre esa lectura y el update de esta misma
    // iteración, el webhook de MP lo aprobó (paid) — la guarda atómica debe rechazar el update.
    const updateMany = vi.fn(async () => ({ count: 0 }));
    const db = {
      order: {
        findMany: vi.fn(async () => [{ id: "o1", status: "pending_payment", createdAt: old }]),
      },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({ order: { updateMany } })),
    } as unknown as ExpiryJobDb;

    const res = await runOrderExpiryJob({ db, now: new Date("2026-06-06T12:00:00Z") });
    expect(res.cancelled).toBe(0);
    expect(updateMany).toHaveBeenCalledWith({ where: { id: "o1", status: "pending_payment" }, data: { status: "cancelled" } });
  });
});
