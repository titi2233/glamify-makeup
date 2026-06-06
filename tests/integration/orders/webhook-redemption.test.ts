import { describe, it, expect, vi } from "vitest";
import { processWebhook, type ProcessWebhookDeps, type WebhookOrder } from "@/lib/orders/webhook-service";

function makeOrder(over: Partial<WebhookOrder> = {}): WebhookOrder {
  return {
    id: "ord1", customerId: "u1", orderNumber: "GLM-000001", status: "pending_payment", couponId: "cpn1",
    contactName: "Ana", contactEmail: "ana@x.com", shippingMethod: "domicilio",
    subtotal: 5000, shippingCost: 2500, discountTotal: 500, total: 7000, items: [], ...over,
  };
}

function makeDeps(order: WebhookOrder) {
  const couponUpsert = vi.fn(async () => ({}));
  const tx = {
    payment: { findFirst: vi.fn(async () => null), update: vi.fn(), create: vi.fn(async () => ({})) },
    order: { updateMany: vi.fn(async () => ({ count: 1 })), update: vi.fn() },
    productVariant: { findMany: vi.fn(async () => []), update: vi.fn() },
    shipment: { create: vi.fn(async () => ({})) },
    coupon: { update: vi.fn(async () => ({})) },
    couponRedemption: { upsert: couponUpsert },
  };
  const deps: ProcessWebhookDeps = {
    db: {
      order: { findFirst: vi.fn(async () => order) },
      $transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
    } as never,
    getPayment: vi.fn(async () => ({ id: 123, status: "approved", external_reference: "ord1", transaction_amount: 7000 })) as never,
    sendEmail: vi.fn(async () => ({ id: null, logged: true })),
    verifySignature: vi.fn(async () => true),
    secret: "s",
    now: new Date("2026-06-06T12:00:00Z"),
  };
  return { deps, couponUpsert };
}

describe("processWebhook — CouponRedemption", () => {
  it("upsertea la redención por clienta al aprobarse el pago", async () => {
    const { deps, couponUpsert } = makeDeps(makeOrder());
    await processWebhook({ dataId: "123", xSignature: null, xRequestId: null }, deps);
    expect(couponUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { customerId_couponId: { customerId: "u1", couponId: "cpn1" } },
    }));
  });
  it("NO upsertea si el pedido fue de invitada (customerId null)", async () => {
    const { deps, couponUpsert } = makeDeps(makeOrder({ customerId: null }));
    await processWebhook({ dataId: "123", xSignature: null, xRequestId: null }, deps);
    expect(couponUpsert).not.toHaveBeenCalled();
  });
});
