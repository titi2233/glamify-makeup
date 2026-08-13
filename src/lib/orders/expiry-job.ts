import { findExpiredOrderIds, type ExpirableOrder } from "@/lib/orders/expiry";
import type { PrismaTransactionClient } from "@/lib/prisma";

export interface ExpiryJobDb {
  order: { findMany: (args: Record<string, unknown>) => Promise<ExpirableOrder[]> };
  $transaction: <T>(fn: (tx: PrismaTransactionClient) => Promise<T>) => Promise<T>;
}

export interface ExpiryJobDeps {
  db: ExpiryJobDb;
  now: Date;
  hours?: number;
}

/**
 * Autocancela pedidos pending_payment vencidos (>24h). NO repone stock:
 * los pending_payment nunca lo descontaron (el descuento ocurre al aprobarse el pago).
 */
export async function runOrderExpiryJob(deps: ExpiryJobDeps): Promise<{ cancelled: number }> {
  const orders = await deps.db.order.findMany({
    where: { status: "pending_payment" },
    select: { id: true, status: true, createdAt: true },
  });
  const expired = findExpiredOrderIds(orders, deps.now, deps.hours ?? 24);
  let cancelled = 0;
  for (const id of expired) {
    await deps.db.$transaction(async (tx) => {
      // Guarda ATÓMICA (mismo patrón que el webhook de MP): precondición de estado en el where.
      // Sin esto, un webhook que apruebe el pago en la ventana entre el findMany de arriba y este
      // update cancelaría un pedido que ya está "paid" — dinero cobrado, pedido marcado cancelado.
      const res = await tx.order.updateMany({ where: { id, status: "pending_payment" }, data: { status: "cancelled" } });
      if (res.count === 1) cancelled++;
    });
  }
  return { cancelled };
}
