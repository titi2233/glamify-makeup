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

  it("cookie + cart previo con items solapados → suma qty y borra item del previo", async () => {
    const db = makeDb({
      cart: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
          where.id === "cookie" ? { id: "cookie", status: "active", customerId: null } : null),
        findFirst: vi.fn(async () => ({ id: "prev", status: "active", customerId: "u1" })),
        update: vi.fn(async () => ({})),
      },
      cartItem: {
        findMany: vi.fn(async ({ where }: { where: { cartId: string } }) => {
          if (where.cartId === "prev") {
            return [{ id: "pi1", variantId: "v1", comboId: null, qty: 2 }];
          }
          return [{ id: "ci1", variantId: "v1", comboId: null, qty: 3 }];
        }),
        update: vi.fn(async () => ({})),
        delete: vi.fn(async () => ({})),
      },
    });
    const res = await mergeGuestCartIntoCustomer(
      { cookieCartId: "cookie", customerId: "u1", marketingConsent: false },
      { db },
    );
    expect(res.canonicalCartId).toBe("cookie");
    // qty sumada en el item de la cookie (3 + 2 = 5)
    expect(db.cartItem.update).toHaveBeenCalledWith({ where: { id: "ci1" }, data: { qty: 5 } });
    // item del previo eliminado
    expect(db.cartItem.delete).toHaveBeenCalledWith({ where: { id: "pi1" } });
    // cart previo abandonado
    expect(db.cart.update).toHaveBeenCalledWith({ where: { id: "prev" }, data: { status: "abandoned" } });
  });

  it("cookie + cart previo con items no solapados → item del previo reasignado a la cookie", async () => {
    const db = makeDb({
      cart: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
          where.id === "cookie" ? { id: "cookie", status: "active", customerId: null } : null),
        findFirst: vi.fn(async () => ({ id: "prev", status: "active", customerId: "u1" })),
        update: vi.fn(async () => ({})),
      },
      cartItem: {
        findMany: vi.fn(async ({ where }: { where: { cartId: string } }) => {
          if (where.cartId === "prev") {
            return [{ id: "pi2", variantId: "v2", comboId: null, qty: 1 }];
          }
          return [{ id: "ci1", variantId: "v1", comboId: null, qty: 3 }];
        }),
        update: vi.fn(async () => ({})),
        delete: vi.fn(async () => ({})),
      },
    });
    const res = await mergeGuestCartIntoCustomer(
      { cookieCartId: "cookie", customerId: "u1", marketingConsent: false },
      { db },
    );
    expect(res.canonicalCartId).toBe("cookie");
    // item del previo reasignado al cart de la cookie
    expect(db.cartItem.update).toHaveBeenCalledWith({ where: { id: "pi2" }, data: { cartId: "cookie" } });
    // no se eliminó ningún item
    expect(db.cartItem.delete).not.toHaveBeenCalled();
    // cart previo abandonado
    expect(db.cart.update).toHaveBeenCalledWith({ where: { id: "prev" }, data: { status: "abandoned" } });
  });
});
