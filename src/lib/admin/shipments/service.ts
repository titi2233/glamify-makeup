import { prisma, type PrismaTransactionClient } from "@/lib/prisma";
import { canTransition, canTransitionShipment } from "@/lib/orders/state-machine";
import { sendEmail as realSendEmail } from "@/lib/email/resend";
import { shipmentDispatchedEmail } from "@/lib/email/templates";
import { autoImportShipment } from "@/lib/orders/auto-shipment";
import { toNumber } from "@/lib/catalog/pricing";
import type { Money } from "@/lib/catalog/types";
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

/** Campos del pedido que necesita el upsert (status + datos para el mail de despacho). */
interface ShipmentOrderRow {
  id: string;
  status: OrderStatus;
  orderNumber: string;
  contactName: string;
  contactEmail: string;
}

export interface ShipmentsDb {
  order: { findUnique: (args: { where: { id: string } }) => Promise<ShipmentOrderRow | null> };
  $transaction: <T>(fn: (tx: PrismaTransactionClient) => Promise<T>) => Promise<T>;
}

export interface ShipmentsDeps {
  db: ShipmentsDb;
  /** Aviso de despacho a la clienta (inyectable para tests). Best-effort. */
  sendEmail?: typeof realSendEmail;
  now?: Date;
}

export function defaultShipmentsDeps(): ShipmentsDeps {
  return { db: prisma as unknown as ShipmentsDb, sendEmail: realSendEmail };
}

/**
 * Crea o actualiza el Shipment del pedido (Order 0..1 Shipment, orderId @unique).
 * Si se carga trackingNumber y la transición a `shipped` es válida, mueve el pedido a `shipped`
 * y le avisa a la clienta por email (una sola vez: reguardar un pedido ya `shipped` no re-dispara).
 * El upsert va en una transacción; el email es best-effort fuera de ella.
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

  let movedToShipped = false;
  await deps.db.$transaction(async (tx) => {
    const existing = await tx.shipment.findUnique({ where: { orderId } });
    if (existing) {
      if (!canTransitionShipment(existing.status, input.status)) {
        throw new Error(`No se puede pasar el envío de "${existing.status}" a "${input.status}" directamente.`);
      }
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
      // Precondición atómica sobre el status (igual que el webhook, webhook-service.ts): si otra
      // llamada concurrente ya movió el pedido a shipped, ésta pierde la carrera (count 0) y NO
      // re-dispara el mail "tu pedido salió" a la clienta.
      const res = await tx.order.updateMany({ where: { id: orderId, status: order.status }, data: { status: "shipped" } });
      movedToShipped = res.count === 1;
    }
  });

  // Aviso a la clienta: "tu pedido salió" con el número de seguimiento. Best-effort: si el mail
  // falla, el envío ya se guardó igual. Solo cuando el pedido RECIÉN pasó a shipped en esta llamada.
  if (movedToShipped && input.trackingNumber && deps.sendEmail) {
    try {
      const mail = shipmentDispatchedEmail({
        orderNumber: order.orderNumber,
        contactName: order.contactName,
        trackingNumber: input.trackingNumber,
        service: input.service,
      });
      await deps.sendEmail({ to: order.contactEmail, subject: mail.subject, html: mail.html, text: mail.text });
    } catch (e) {
      console.error(`[shipment] no pude avisar a la clienta del pedido ${order.orderNumber}:`, e instanceof Error ? e.message : e);
    }
  }

  return { id: orderId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reintento manual de la carga en MiCorreo desde el panel.
//
// El auto-import corre en el webhook al pagar. Si ahí falló (API caída, dirección
// incompleta, etc.) o el pedido es viejo, la dueña puede reintentar desde el detalle
// del pedido. Es idempotente: MiCorreo rechaza el `extOrderId` duplicado y eso se
// trata como éxito (ver auto-shipment.ts).
// ─────────────────────────────────────────────────────────────────────────────

/** Estados en los que tiene sentido cargar/pre-imponer un envío (ya pagado). */
const RETRY_ALLOWED_STATUSES: OrderStatus[] = ["paid", "preparing", "shipped", "delivered"];

/** Campos del pedido que necesita el reintento de import (+ el Shipment para no duplicar). */
interface RetryImportOrderRow {
  status: OrderStatus;
  orderNumber: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  shippingMethod: string;
  shippingAddress: unknown;
  weightGr: number;
  subtotal: Money;
  shippingCost: Money;
  shipment: { trackingNumber: string | null; micorreoImportedAt: Date | null } | null;
}

export interface RetryImportDb {
  order: { findUnique: (args: { where: { id: string }; include?: unknown }) => Promise<RetryImportOrderRow | null> };
  shipment: {
    upsert: (args: {
      where: { orderId: string };
      update: { service: string; micorreoImportedAt: Date };
      create: { orderId: string; cost: number; status: ShipmentStatus; service: string; micorreoImportedAt: Date };
    }) => Promise<unknown>;
  };
}

export interface RetryImportDeps {
  db: RetryImportDb;
  /** Inyectable para tests; default = auto-import real contra MiCorreo. */
  autoImport?: typeof autoImportShipment;
  now?: Date;
}

export function defaultRetryImportDeps(): RetryImportDeps {
  return { db: prisma as unknown as RetryImportDb };
}

/**
 * Reintenta la pre-imposición en MiCorreo y, si sale, marca el Shipment como importado.
 * Defensas contra duplicar un envío real:
 *  - Sólo pedidos pagados (RETRY_ALLOWED_STATUSES).
 *  - Si el pedido YA tiene tracking (despachado) o YA está importado, no le pega de nuevo a la API.
 *  - `upsert`: crea el Shipment si no existía (pedido marcado pagado a mano, sin fila).
 */
export async function retryMicorreoImport(
  orderId: string,
  deps: RetryImportDeps,
): Promise<{ imported: boolean; detail: string }> {
  const order = await deps.db.order.findUnique({ where: { id: orderId }, include: { shipment: true } });
  if (!order) return { imported: false, detail: "El pedido no existe." };
  if (!RETRY_ALLOWED_STATUSES.includes(order.status)) {
    return { imported: false, detail: "El pedido todavía no está pagado." };
  }
  // Ya despachado: no re-importar (evita duplicar un envío que ya salió, incluso si se cargó a mano).
  if (order.shipment?.trackingNumber) {
    return { imported: true, detail: "El pedido ya está despachado (tiene número de seguimiento)." };
  }
  // Ya pre-impuesto antes: no repegarle a la API.
  if (order.shipment?.micorreoImportedAt) {
    return { imported: true, detail: "Este pedido ya estaba cargado en MiCorreo." };
  }

  const now = deps.now ?? new Date();
  const autoImport = deps.autoImport ?? autoImportShipment;
  const outcome = await autoImport({
    orderNumber: order.orderNumber,
    contactName: order.contactName,
    contactEmail: order.contactEmail,
    contactPhone: order.contactPhone,
    shippingMethod: order.shippingMethod,
    shippingAddress: order.shippingAddress,
    weightGr: order.weightGr,
    declaredValue: toNumber(order.subtotal),
  });

  if (outcome.imported) {
    // upsert: si el pedido se marcó pagado a mano no hay Shipment todavía; lo creamos.
    await deps.db.shipment.upsert({
      where: { orderId },
      update: { service: outcome.service, micorreoImportedAt: now },
      create: { orderId, cost: toNumber(order.shippingCost), status: "pending", service: outcome.service, micorreoImportedAt: now },
    });
  }
  return { imported: outcome.imported, detail: outcome.detail };
}
