import { describe, it, expect } from "vitest";
import { findAbandonedCarts, type AbandonedCartRow } from "@/lib/cart/abandoned";

const now = new Date("2026-06-06T12:00:00Z");
const old = new Date("2026-06-05T11:00:00Z"); // 25h antes
const recent = new Date("2026-06-06T11:00:00Z"); // 1h antes

function row(over: Partial<AbandonedCartRow>): AbandonedCartRow {
  return { cartId: "c", email: "a@b.com", consent: true, updatedAt: old, itemCount: 1, abandonedEmailSentAt: null, ...over };
}

describe("findAbandonedCarts", () => {
  it("elige carritos con email+consent, items, idle≥24h y sin email enviado", () => {
    expect(findAbandonedCarts([row({ cartId: "c1" })], now)).toEqual(["c1"]);
  });
  it("excluye sin consentimiento", () => {
    expect(findAbandonedCarts([row({ cartId: "c2", consent: false })], now)).toEqual([]);
  });
  it("excluye sin email", () => {
    expect(findAbandonedCarts([row({ cartId: "c3", email: null })], now)).toEqual([]);
  });
  it("excluye carritos recientes (<24h)", () => {
    expect(findAbandonedCarts([row({ cartId: "c4", updatedAt: recent })], now)).toEqual([]);
  });
  it("excluye carritos vacíos", () => {
    expect(findAbandonedCarts([row({ cartId: "c5", itemCount: 0 })], now)).toEqual([]);
  });
  it("excluye si ya se envió el email", () => {
    expect(findAbandonedCarts([row({ cartId: "c6", abandonedEmailSentAt: recent })], now)).toEqual([]);
  });
});
