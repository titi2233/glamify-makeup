import { describe, it, expect } from "vitest";
import { decideWebhookEffects } from "@/lib/payments/webhook-effects";

describe("decideWebhookEffects", () => {
  it("approved sobre pending_payment → paga, descuenta, cupón, emails", () => {
    const e = decideWebhookEffects({ currentOrderStatus: "pending_payment", mpStatus: "approved", hasCoupon: true });
    expect(e).toEqual({
      updatePaymentTo: "approved",
      setOrderStatusTo: "paid",
      decrementStock: true,
      incrementCouponUse: true,
      sendCustomerEmail: true,
      sendOwnerEmail: true,
    });
  });
  it("approved sin cupón → no incrementa cupón", () => {
    expect(decideWebhookEffects({ currentOrderStatus: "pending_payment", mpStatus: "approved", hasCoupon: false }).incrementCouponUse).toBe(false);
  });
  it("approved repetido sobre pedido ya paid → idempotente (sin efectos secundarios)", () => {
    const e = decideWebhookEffects({ currentOrderStatus: "paid", mpStatus: "approved", hasCoupon: true });
    expect(e).toEqual({
      updatePaymentTo: "approved",
      setOrderStatusTo: null,
      decrementStock: false,
      incrementCouponUse: false,
      sendCustomerEmail: false,
      sendOwnerEmail: false,
    });
  });
  it("rejected sobre pending_payment → actualiza pago, no cambia pedido (reintento)", () => {
    const e = decideWebhookEffects({ currentOrderStatus: "pending_payment", mpStatus: "rejected", hasCoupon: false });
    expect(e.updatePaymentTo).toBe("rejected");
    expect(e.setOrderStatusTo).toBeNull();
    expect(e.decrementStock).toBe(false);
  });
  it("refunded sobre pedido paid → refunded, sin re-descuento", () => {
    const e = decideWebhookEffects({ currentOrderStatus: "paid", mpStatus: "refunded", hasCoupon: false });
    expect(e.setOrderStatusTo).toBe("refunded");
    expect(e.decrementStock).toBe(false);
  });
});
