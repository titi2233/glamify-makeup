import { prisma, type PrismaTransactionClient } from "@/lib/prisma";
import { canTransition } from "@/lib/orders/state-machine";
import type { ShipmentStatus, ShipmentCarrier, OrderStatus } from "@prisma/client";

/** Datos de envío que carga la admin en el detalle del pedido. */
export interface ShipmentInput {
  service: string | null;
  trackingNumber: string | null;
  labelUrl: string | null;
  cost: number;
  status: ShipmentStatus;
  carrier?: ShipmentCarrier;
}

export interface ShipmentsDb {
  order: { findUnique: (args: { where: { id: string } }) => Promise<{ id: string; status: OrderStatus } | null> };
  $transaction: <T>(fn: (tx: PrismaTransactionClient) => Promise<T>) => Promise<T>;
}

export interface ShipmentsDeps {
  db: ShipmentsDb;
  now?: Date;
}

export function defaultShipmentsDeps(): ShipmentsDeps {
  return { db: prisma as unknown as ShipmentsDb };
}

/**
 * Crea o actualiza el Shipment del pedido (Order 0..1 Shipment, orderId @unique).
 * Si se carga trackingNumber y la transición a `shipped` es válida, mueve el pedido a `shipped`.
 * Todo dentro de una misma transacción.
 */
export async function upsertShipment(
  orderId: string,
  input: ShipmentInput,
  deps: ShipmentsDeps,
): Promise<{ id: string }> {
  const order = await deps.db.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("El pedido no existe.");

  const data = {
    carrier: input.carrier ?? ("correo_argentino" as ShipmentCarrier),
    service: input.service,
    trackingNumber: input.trackingNumber,
    labelUrl: input.labelUrl,
    cost: input.cost,
    status: input.status,
  };

  await deps.db.$transaction(async (tx) => {
    const existing = await tx.shipment.findUnique({ where: { orderId } });
    if (existing) {
      await tx.shipment.update({ where: { orderId }, data });
    } else {
      await tx.shipment.create({ data: { orderId, ...data } });
    }
    // Cargar tracking mueve el pedido a shipped (guardado por la máquina de estados).
    if (
      input.trackingNumber &&
      order.status !== "shipped" &&
      canTransition(order.status, "shipped")
    ) {
      await tx.order.update({ where: { id: orderId }, data: { status: "shipped" } });
    }
  });

  return { id: orderId };
}
