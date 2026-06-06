import { describe, it, expect, vi } from "vitest";
import { createCheckout, type CreateCheckoutDeps, type CheckoutDb } from "@/lib/orders/checkout-service";
import type { CartLine } from "@/lib/cart/types";

const line: CartLine = { id: "i1", kind: "variant", refId: "v1", unitPrice: 5000, qty: 1, weightGr: 50, productId: "p1", categoryId: "c1" };

function makeDeps(redemptions: number): { deps: CreateCheckoutDeps; createOrder: ReturnType<typeof vi.fn> } {
  const createOrder = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "ord1", orderNumber: "GLM-000001", ...data, payments: [{ id: "pay1" }] }));
  const db = {
    coupon: { findUnique: vi.fn(async () => ({
      id: "cpn1", code: "RECOMPRA", type: "percentage", value: 10, scope: "all", scopeId: null,
      active: true, minSubtotal: null, validFrom: null, validTo: null, maxUses: null, usedCount: 0, perCustomerLimit: 1,
    })) },
    couponRedemption: { findUnique: vi.fn(async () => (redemptions > 0 ? { redeemedCount: redemptions } : null)) },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      order: { create: createOrder },
      cart: { update: vi.fn(async () => ({})) },
      payment: { update: vi.fn(async () => ({})) },
    })),
  } as unknown as CheckoutDb;

  const deps: CreateCheckoutDeps = {
    db,
    nextOrderSeq: vi.fn(async () => 1),
    createPreference: vi.fn(async () => ({ id: "pref1", init_point: "http://mp", sandbox_init_point: "http://mp" })) as never,
    quoteShipping: vi.fn(async () => ({ cost: 2500, free: false, source: "zone" as const, zoneId: "z1" })),
    appUrl: "http://localhost:3000",
    now: new Date("2026-06-06T12:00:00Z"),
  };
  return { deps, createOrder };
}

describe("createCheckout — perCustomerLimit", () => {
  it("NO aplica el cupón si la clienta superó su límite (descuento 0)", async () => {
    const { deps, createOrder } = makeDeps(1);
    await createCheckout({
      contactName: "Ana", contactEmail: "ana@x.com", contactPhone: "11", shippingMethod: "domicilio",
      address: { cp: "1414" }, lines: [{ line, productNameSnapshot: "P", variantNameSnapshot: "V", skuSnapshot: "S", title: "P—V" }],
      couponCode: "RECOMPRA", customerId: "u1", cartId: "cart1",
    }, deps);
    expect(createOrder).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ discountTotal: 0, couponId: null }),
    }));
  });

  it("aplica el cupón si está por debajo del límite", async () => {
    const { deps, createOrder } = makeDeps(0);
    await createCheckout({
      contactName: "Ana", contactEmail: "ana@x.com", contactPhone: "11", shippingMethod: "domicilio",
      address: { cp: "1414" }, lines: [{ line, productNameSnapshot: "P", variantNameSnapshot: "V", skuSnapshot: "S", title: "P—V" }],
      couponCode: "RECOMPRA", customerId: "u1", cartId: "cart1",
    }, deps);
    const call = createOrder.mock.calls[0][0] as { data: { couponId: string | null; discountTotal: number } };
    expect(call.data.couponId).toBe("cpn1");
    expect(call.data.discountTotal).toBeGreaterThan(0);
  });
});
