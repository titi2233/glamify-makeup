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

/** Precedencia lineal de PaymentStatus (no es una máquina de estados con transiciones válidas
 *  como OrderStatus, solo "no retroceder"): pending/in_process < approved/rejected < refunded/cancelled.
 *  Un webhook reordenado (ej. un "in_process" viejo reintentado después de "approved") no debe
 *  pisar hacia atrás el status del Payment. */
const PAYMENT_STATUS_PRECEDENCE: Record<PaymentStatus, number> = {
  pending: 0,
  in_process: 0,
  approved: 1,
  rejected: 1,
  refunded: 2,
  cancelled: 2,
};

/** ¿`next` es igual o más avanzado que `current` en la precedencia? Si no, no hay que pisar. */
export function paymentStatusAdvances(current: PaymentStatus, next: PaymentStatus): boolean {
  return PAYMENT_STATUS_PRECEDENCE[next] >= PAYMENT_STATUS_PRECEDENCE[current];
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
