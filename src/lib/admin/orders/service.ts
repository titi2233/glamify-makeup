import { prisma, type PrismaTransactionClient } from "@/lib/prisma";
import { canTransition } from "@/lib/orders/state-machine";
import { computeStockDecrements } from "@/lib/orders/stock";
import type { CartLine } from "@/lib/cart/types";
import type { OrderStatus } from "@prisma/client";

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Pendiente de pago",
  paid: "Pagado",
  preparing: "Preparando",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

/** Item mínimo del pedido para recomputar stock (combo expandido a componentes). */
export interface AdminOrderItem {
  id: string;
  variantId: string | null;
  comboId: string | null;
  qty: number;
  combo: { items: Array<{ variantId: string; qty: number }> } | null;
}

/** Superficie mínima del pedido que el servicio necesita. */
export interface AdminOrder {
  id: string;
  status: OrderStatus;
  couponId: string | null;
  items: AdminOrderItem[];
}

/** Superficie mínima de DB (para inyectar fakes en tests). */
export interface OrdersDb {
  order: { findUnique: (args: { where: { id: string }; include?: unknown }) => Promise<AdminOrder | null> };
  $transaction: <T>(fn: (tx: PrismaTransactionClient) => Promise<T>) => Promise<T>;
}

export interface OrdersDeps {
  db: OrdersDb;
  now?: Date;
}

export function defaultOrdersDeps(): OrdersDeps {
  return { db: prisma as unknown as OrdersDb };
}

/** include para cargar el pedido con lo necesario para restock. */
const orderInclude = { items: { include: { combo: { include: { items: true } } } } } as const;

/** Convierte un OrderItem a CartLine para computar decrementos/incrementos de stock. */
function orderItemToLine(it: AdminOrderItem): CartLine {
  if (it.comboId && it.combo) {
    return {
      id: it.id,
      kind: "combo",
      refId: it.comboId,
      unitPrice: 0,
      qty: it.qty,
      weightGr: 0,
      components: it.combo.items.map((ci) => ({ variantId: ci.variantId, qty: ci.qty })),
    };
  }
  return {
    id: it.id,
    kind: "variant",
    refId: it.variantId ?? "",
    unitPrice: 0,
    qty: it.qty,
    weightGr: 0,
  };
}

/** Cambia el estado del pedido validando la transición (blueprint 04 §3). Lanza con mensaje claro si es inválida. */
export async function changeOrderStatus(
  orderId: string,
  to: OrderStatus,
  deps: OrdersDeps,
): Promise<{ id: string }> {
  const order = await deps.db.order.findUnique({ where: { id: orderId }, include: orderInclude });
  if (!order) throw new Error("El pedido no existe.");
  if (order.status === to) return { id: order.id };
  if (!canTransition(order.status, to)) {
    throw new Error(
      `No se puede pasar de "${STATUS_LABELS[order.status]}" a "${STATUS_LABELS[to]}".`,
    );
  }
  await deps.db.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { status: to } });
  });
  return { id: order.id };
}

/**
 * Cancela el pedido. Si el estado previo descontó stock (paid/preparing/shipped),
 * repone el stock de las variantes/combos en la misma transacción.
 */
export async function cancelOrder(orderId: string, deps: OrdersDeps): Promise<{ id: string }> {
  const order = await deps.db.order.findUnique({ where: { id: orderId }, include: orderInclude });
  if (!order) throw new Error("El pedido no existe.");
  if (order.status === "cancelled") return { id: order.id };
  if (!canTransition(order.status, "cancelled")) {
    throw new Error(
      `No se puede cancelar un pedido en estado "${STATUS_LABELS[order.status]}".`,
    );
  }
  const shouldRestock =
    order.status === "paid" || order.status === "preparing" || order.status === "shipped";
  await deps.db.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { status: "cancelled" } });
    if (shouldRestock) {
      const decrements = computeStockDecrements(order.items.map(orderItemToLine));
      for (const [variantId, qty] of decrements) {
        if (variantId && qty > 0) {
          await tx.productVariant.update({
            where: { id: variantId },
            data: { stock: { increment: qty } },
          });
        }
      }
    }
  });
  return { id: order.id };
}

export { STATUS_LABELS };
