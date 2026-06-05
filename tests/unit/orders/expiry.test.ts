import { describe, it, expect } from "vitest";
import { findExpiredOrderIds, type ExpirableOrder } from "@/lib/orders/expiry";

const NOW = new Date("2026-06-04T12:00:00Z");
const order = (id: string, status: ExpirableOrder["status"], hoursAgo: number): ExpirableOrder => ({
  id, status, createdAt: new Date(NOW.getTime() - hoursAgo * 3600_000),
});

describe("findExpiredOrderIds", () => {
  it("solo pending_payment con > 24h", () => {
    const orders = [
      order("a", "pending_payment", 25),
      order("b", "pending_payment", 23),
      order("c", "paid", 48),
    ];
    expect(findExpiredOrderIds(orders, NOW)).toEqual(["a"]);
  });
  it("respeta un umbral configurable", () => {
    expect(findExpiredOrderIds([order("a", "pending_payment", 2)], NOW, 1)).toEqual(["a"]);
  });
});
