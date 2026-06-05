import type { OrderStatus, PaymentStatus } from "@prisma/client";

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["paid", "cancelled"],
  paid: ["preparing", "refunded", "cancelled"],
  preparing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
  refunded: [],
};

/** ¿Es válida la transición de estado de pedido? (blueprint 04 §3) */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Estado de pedido derivado del estado de pago de MP. `null` = no cambiar el pedido.
 * rejected NO cancela (se permite reintento); el autocancel a 24h lo maneja expiry.ts.
 */
export function orderStatusForPayment(mp: PaymentStatus): OrderStatus | null {
  switch (mp) {
    case "approved": return "paid";
    case "refunded": return "refunded";
    case "cancelled": return "cancelled";
    default: return null; // pending, in_process, rejected
  }
}
