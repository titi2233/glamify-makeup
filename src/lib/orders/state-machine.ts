import type { OrderStatus, PaymentStatus, ShipmentStatus } from "@prisma/client";

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

/** Flujo de envío (blueprint 05 §6): pending → ready → dispatched → in_transit → delivered (+returned
 *  desde que ya salió, no antes). `delivered`/`returned` son terminales. */
const SHIPMENT_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  pending: ["ready"],
  ready: ["dispatched"],
  dispatched: ["in_transit", "returned"],
  in_transit: ["delivered", "returned"],
  delivered: [],
  returned: [],
};

/** ¿Es válida la transición de estado de envío? El no-op (from === to) siempre es válido. */
export function canTransitionShipment(from: ShipmentStatus, to: ShipmentStatus): boolean {
  if (from === to) return true;
  return SHIPMENT_TRANSITIONS[from]?.includes(to) ?? false;
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
