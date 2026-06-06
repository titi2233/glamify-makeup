import { describe, it, expect, vi } from "vitest";
import { runOrderExpiryJob, type ExpiryJobDb } from "@/lib/orders/expiry-job";

const old = new Date("2026-06-05T10:00:00Z"); // >24h
const recent = new Date("2026-06-06T11:30:00Z");

describe("runOrderExpiryJob", () => {
  it("cancela pending_payment con más de 24h", async () => {
    const update = vi.fn(async () => ({}));
    const db = {
      order: {
        findMany: vi.fn(async () => [
          { id: "o1", status: "pending_payment", createdAt: old },
          { id: "o2", status: "pending_payment", createdAt: recent },
        ]),
      },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({ order: { update } })),
    } as unknown as ExpiryJobDb;

    const res = await runOrderExpiryJob({ db, now: new Date("2026-06-06T12:00:00Z") });
    expect(res.cancelled).toBe(1);
    expect(update).toHaveBeenCalledWith({ where: { id: "o1" }, data: { status: "cancelled" } });
  });
});
