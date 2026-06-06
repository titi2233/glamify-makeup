import { describe, it, expect, vi } from "vitest";
import { mergeGuestCartIntoCustomer, type MergeCartDb } from "@/lib/cart/merge";

function makeDb(over: Partial<Record<string, unknown>> = {}) {
  return {
    cart: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === "cookie" ? { id: "cookie", status: "active", customerId: null } : null),
      findFirst: vi.fn(async () => null), // sin cart previo de la clienta
      update: vi.fn(async () => ({})),
    },
    cartItem: { findMany: vi.fn(async () => []), update: vi.fn(async () => ({})), delete: vi.fn(async () => ({})) },
    ...over,
  } as unknown as MergeCartDb;
}

describe("mergeGuestCartIntoCustomer", () => {
  it("asigna customerId al cart de la cookie y propaga consentimiento", async () => {
    const db = makeDb();
    const res = await mergeGuestCartIntoCustomer(
      { cookieCartId: "cookie", customerId: "u1", marketingConsent: true },
      { db },
    );
    expect(res.canonicalCartId).toBe("cookie");
    expect(db.cart.update).toHaveBeenCalledWith({
      where: { id: "cookie" },
      data: { customerId: "u1", recoveryEmailConsent: true },
    });
  });

  it("sin cookie pero con cart previo de la clienta → devuelve ese id", async () => {
    const db = makeDb({
      cart: {
        findUnique: vi.fn(async () => null),
        findFirst: vi.fn(async () => ({ id: "prev", status: "active", customerId: "u1" })),
        update: vi.fn(async () => ({})),
      },
    });
    const res = await mergeGuestCartIntoCustomer(
      { cookieCartId: null, customerId: "u1", marketingConsent: false },
      { db },
    );
    expect(res.canonicalCartId).toBe("prev");
  });

  it("sin cookie ni cart previo → null", async () => {
    const db = makeDb({
      cart: { findUnique: vi.fn(async () => null), findFirst: vi.fn(async () => null), update: vi.fn(async () => ({})) },
    });
    const res = await mergeGuestCartIntoCustomer(
      { cookieCartId: null, customerId: "u1", marketingConsent: false },
      { db },
    );
    expect(res.canonicalCartId).toBeNull();
  });
});
