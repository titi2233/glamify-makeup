import type { OrderStatus, PaymentStatus } from "@prisma/client";
import { canTransition, orderStatusForPayment } from "@/lib/orders/state-machine";

export interface WebhookDecisionInput {
  currentOrderStatus: OrderStatus;
  mpStatus: PaymentStatus;
  hasCoupon: boolean;
}
export interface WebhookEffects {
  updatePaymentTo: PaymentStatus;
  setOrderStatusTo: OrderStatus | null;
  decrementStock: boolean;
  incrementCouponUse: boolean;
  sendCustomerEmail: boolean;
  sendOwnerEmail: boolean;
}

/**
 * Decide los efectos de un webhook de pago. Idempotente: los efectos "una vez"
 * (stock, cupón, emails) solo ocurren al transicionar realmente pending_payment → paid.
 */
export function decideWebhookEffects(input: WebhookDecisionInput): WebhookEffects {
  const { currentOrderStatus, mpStatus, hasCoupon } = input;
  const target = orderStatusForPayment(mpStatus);
  const willTransition = target !== null && canTransition(currentOrderStatus, target);
  const becomingPaid = willTransition && target === "paid";

  return {
    updatePaymentTo: mpStatus,
    setOrderStatusTo: willTransition ? target : null,
    decrementStock: becomingPaid,
    incrementCouponUse: becomingPaid && hasCoupon,
    sendCustomerEmail: becomingPaid,
    sendOwnerEmail: becomingPaid,
  };
}
