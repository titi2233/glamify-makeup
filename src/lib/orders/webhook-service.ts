// NOTA: sin `import "server-only"` — lo importa scripts/simulate-mp-webhook.ts (node). Server por importar prisma.
import { prisma, type PrismaTransactionClient } from "@/lib/prisma";
import { verifyMpSignature } from "@/lib/payments/signature";
import { getPayment as realGetPayment, mpStatusToPaymentStatus } from "@/lib/payments/mercadopago";
import { decideWebhookEffects, paymentStatusAdvances } from "@/lib/payments/webhook-effects";
import { computeStockDecrements, type Shortage } from "@/lib/orders/stock";
import { sendEmail as realSendEmail } from "@/lib/email/resend";
import { orderConfirmationEmail, newOrderAlertEmail, type OrderEmailData } from "@/lib/email/templates";
import { toNumber } from "@/lib/catalog/pricing";
import { autoImportShipment as autoImportShipmentImpl, type AutoShipmentOrder, type AutoShipmentOutcome } from "@/lib/orders/auto-shipment";
import type { CartLine } from "@/lib/cart/types";
import type { OrderStatus } from "@prisma/client";
import type { Money } from "@/lib/catalog/types";

export interface ProcessWebhookInput {
  dataId: string;
  xSignature: string | null;
  xRequestId: string | null;
}
/** Interfaz mínima de la DB necesaria para el webhook (para inyectar fakes en tests). */
export interface WebhookDb {
  order: { findFirst: (args: Record<string, unknown>) => Promise<WebhookOrder | null> };
  shipment: { update: (args: { where: { orderId: string }; data: { service?: string; micorreoImportedAt?: Date } }) => Promise<unknown> };
  $transaction: <T>(fn: (tx: PrismaTransactionClient) => Promise<T>) => Promise<T>;
}

/** Shape mínimo de pedido para el webhook (incluye items + combo). */
export interface WebhookOrderItem {
  id: string;
  variantId: string | null;
  comboId: string | null;
  productNameSnapshot: string;
  variantNameSnapshot: string | null;
  skuSnapshot: string | null;
  unitPriceSnapshot: Money;
  qty: number;
  lineTotal: Money;
  combo: { items: Array<{ variantId: string; qty: number }> } | null;
}
export interface WebhookOrder {
  id: string;
  customerId: string | null;
  orderNumber: string;
  status: OrderStatus;
  couponId: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  shippingMethod: string;
  shippingAddress: unknown;
  weightGr: number;
  subtotal: Money;
  shippingCost: Money;
  discountTotal: Money;
  total: Money;
  items: WebhookOrderItem[];
}

export interface ProcessWebhookDeps {
  db: WebhookDb;
  getPayment: typeof realGetPayment;
  sendEmail: typeof realSendEmail;
  verifySignature: (input: { xSignature: string | null; xRequestId: string | null; dataId: string; secret: string }) => Promise<boolean>;
  secret: string;
  ownerEmail?: string;
  /** Envío automático a MiCorreo al pagar (inyectable para tests). Best-effort. */
  autoImportShipment?: (order: AutoShipmentOrder) => Promise<AutoShipmentOutcome>;
  now?: Date;
}
export interface ProcessWebhookResult {
  status: 200 | 401;
  detail: string;
}

export function defaultWebhookDeps(): ProcessWebhookDeps {
  return {
    db: prisma as unknown as WebhookDb,
    getPayment: realGetPayment,
    sendEmail: realSendEmail,
    verifySignature: verifyMpSignature,
    secret: process.env.MP_WEBHOOK_SECRET ?? "",
    ownerEmail: process.env.RESEND_OWNER_EMAIL ?? "",
  };
}

/** Convierte un OrderItem (con snapshots) a CartLine para computar decrementos de stock. */
function orderItemToLine(it: WebhookOrderItem): CartLine {
  if (it.comboId && it.combo) {
    return { id: it.id ?? it.comboId, kind: "combo", refId: it.comboId, unitPrice: toNumber(it.unitPriceSnapshot), qty: it.qty, weightGr: 0, components: it.combo.items.map((ci) => ({ variantId: ci.variantId, qty: ci.qty })) };
  }
  return { id: it.id ?? it.variantId ?? "", kind: "variant", refId: it.variantId ?? "", unitPrice: toNumber(it.unitPriceSnapshot), qty: it.qty, weightGr: 0 };
}

export async function processWebhook(input: ProcessWebhookInput, deps: ProcessWebhookDeps): Promise<ProcessWebhookResult> {
  // 1. Verificar firma (origen).
  const valid = await deps.verifySignature({ xSignature: input.xSignature, xRequestId: input.xRequestId, dataId: input.dataId, secret: deps.secret });
  if (!valid) return { status: 401, detail: "Firma inválida." };

  // 2. Consultar el pago a MP (fuente de verdad).
  const mpPayment = await deps.getPayment(input.dataId);
  const paymentStatus = mpStatusToPaymentStatus(mpPayment.status);
  const orderId = mpPayment.external_reference;
  if (!orderId) return { status: 200, detail: "Sin external_reference." };

  // 3. Cargar el pedido con items (+ combo items para stock).
  const order = await deps.db.order.findFirst({
    where: { id: orderId },
    include: { items: { include: { combo: { include: { items: true } } } } },
  });
  if (!order) return { status: 200, detail: "Pedido inexistente (ack)." };

  // 4. Decidir efectos (idempotente por Order.status).
  const effects = decideWebhookEffects({ currentOrderStatus: order.status, mpStatus: paymentStatus, hasCoupon: Boolean(order.couponId) });

  let oversoldLines: Array<{ name: string }> = [];
  // Solo UN webhook gana la transición pending_payment → paid (guarda atómica dentro de la tx).
  // Los efectos "una sola vez" (stock, cupón, shipment, emails) se gatean por esto, no por el
  // estado leído antes de la tx — así MP entregando el mismo aviso en paralelo no doble-descuenta.
  let wonPaidTransition = false;

  // 5. Aplicar en tx.
  await deps.db.$transaction(async (tx: PrismaTransactionClient) => {
    // Reconciliar el Payment: reusar la fila creada en el checkout (mpPaymentId aún null) o la ya
    // vinculada a este pago; nunca dejar un huérfano "pending" extra. Idempotente por mpPaymentId.
    const mpId = String(mpPayment.id);
    const amount = mpPayment.transaction_amount ?? toNumber(order.total);
    const existingPayment = await tx.payment.findFirst({
      where: { orderId: order.id, OR: [{ mpPaymentId: mpId }, { mpPaymentId: null }] },
      orderBy: { createdAt: "asc" },
    });
    if (existingPayment) {
      // Monotonía: un webhook reordenado (ej. "in_process" viejo reintentado después de que ya
      // llegó "approved") no debe hacer retroceder el status — solo se pisa si avanza o iguala.
      const nextStatus = paymentStatusAdvances(existingPayment.status, effects.updatePaymentTo)
        ? effects.updatePaymentTo
        : existingPayment.status;
      await tx.payment.update({ where: { id: existingPayment.id }, data: { mpPaymentId: mpId, status: nextStatus, amount, rawPayload: mpPayment as unknown as object } });
    } else {
      await tx.payment.create({ data: { orderId: order.id, provider: "mercadopago", mpPaymentId: mpId, status: effects.updatePaymentTo, amount, rawPayload: mpPayment as unknown as object } });
    }

    if (effects.setOrderStatusTo === "paid") {
      // Guarda ATÓMICA: updateMany con precondición de estado. READ COMMITTED no serializa dos
      // findFirst previos, pero sí esta escritura condicional → solo una invocación obtiene count 1.
      const res = await tx.order.updateMany({ where: { id: order.id, status: "pending_payment" }, data: { status: "paid" } });
      wonPaidTransition = res.count === 1;
    } else if (effects.setOrderStatusTo) {
      // Misma guarda atómica que la transición a "paid": precondición sobre el status con el que
      // se calcularon los `effects` (order.status, leído fuera de la tx). Si otra invocación ya
      // movió el pedido a otro estado mientras tanto, esta escritura pierde la carrera (count 0)
      // en vez de pisar ciegamente — evita que un webhook "cancelled"/"refunded" desactualizado
      // sobrescriba un pedido que ya está "paid".
      await tx.order.updateMany({ where: { id: order.id, status: order.status }, data: { status: effects.setOrderStatusTo } });
    }

    // Efectos de una sola vez: SOLO si este webhook ganó la transición a paid.
    if (wonPaidTransition) {
      const lines = order.items.map(orderItemToLine);
      const decrements = computeStockDecrements(lines);
      // Update atómico CON precondición de stock real (stock >= qty) por variante — a diferencia
      // de leer un snapshot con findMany y decrementar después, esto evita que dos pedidos que
      // compiten por la misma variante lean el mismo stock y ambos decrementen (oversell, stock
      // negativo). count===0 es la señal real de faltante (reemplaza el chequeo contra el snapshot
      // stale de checkAvailability).
      const shortages: Shortage[] = [];
      for (const [variantId, qty] of decrements) {
        const res = await tx.productVariant.updateMany({ where: { id: variantId, stock: { gte: qty } }, data: { stock: { decrement: qty } } });
        if (res.count === 0) shortages.push({ variantId, needed: qty, available: 0 });
      }
      if (shortages.length > 0) {
        oversoldLines = order.items
          .filter((it) =>
            it.variantId
              ? shortages.some((s) => s.variantId === it.variantId)
              : // línea de combo: matchea si algún componente está en falta
                (it.combo?.items.some((ci) => shortages.some((s) => s.variantId === ci.variantId)) ?? false),
          )
          .map((it) => ({ name: it.variantNameSnapshot ? `${it.productNameSnapshot} (${it.variantNameSnapshot})` : it.productNameSnapshot }));
      }
      await tx.shipment.create({ data: { orderId: order.id, status: "pending", cost: toNumber(order.shippingCost) } });

      if (order.couponId) {
        // TOCTOU: perCustomerLimit/maxUses se validan en el checkout (lectura, antes de pagar), pero
        // el incremento real pasa acá. Reafirmar de forma atómica (mismo patrón que el stock: update
        // condicionado al valor leído en este momento) evita que dos pedidos que ganaron la carrera
        // del checkout con el mismo cupón terminen superando el límite al pagar ambos.
        const coupon = await tx.coupon.findUnique({ where: { id: order.couponId }, select: { maxUses: true, perCustomerLimit: true } });
        if (coupon?.maxUses != null) {
          await tx.coupon.updateMany({ where: { id: order.couponId, usedCount: { lt: coupon.maxUses } }, data: { usedCount: { increment: 1 } } });
        } else {
          await tx.coupon.update({ where: { id: order.couponId }, data: { usedCount: { increment: 1 } } });
        }

        if (order.customerId && coupon) {
          if (coupon.perCustomerLimit != null) {
            const res = await tx.couponRedemption.updateMany({
              where: { customerId: order.customerId, couponId: order.couponId, redeemedCount: { lt: coupon.perCustomerLimit } },
              data: { redeemedCount: { increment: 1 }, lastRedeemedAt: deps.now ?? new Date() },
            });
            if (res.count === 0) {
              // No había fila todavía (primer uso de esta clienta) → crearla si el límite lo permite.
              // Si ya existía, es que esta clienta ya está en el límite: no incrementar más (igual que
              // el stock, "no pasarse" en vez de sobrescribir un límite ya alcanzado).
              const exists = await tx.couponRedemption.findUnique({
                where: { customerId_couponId: { customerId: order.customerId, couponId: order.couponId } },
              });
              if (!exists && coupon.perCustomerLimit > 0) {
                await tx.couponRedemption.create({
                  data: { customerId: order.customerId, couponId: order.couponId, redeemedCount: 1, lastRedeemedAt: deps.now ?? new Date() },
                });
              }
            }
          } else {
            await tx.couponRedemption.upsert({
              where: { customerId_couponId: { customerId: order.customerId, couponId: order.couponId } },
              create: { customerId: order.customerId, couponId: order.couponId, redeemedCount: 1, lastRedeemedAt: deps.now ?? new Date() },
              update: { redeemedCount: { increment: 1 }, lastRedeemedAt: deps.now ?? new Date() },
            });
          }
        }
      }
    }
  });

  // 6. Efectos externos (fuera de tx) — solo si ganamos la transición a paid (una sola vez).
  if (wonPaidTransition) {
    // 6a. Envío automático a MiCorreo PRIMERO, así la alerta a la dueña puede avisar si falló.
    // Best-effort: un fallo NO voltea el webhook (el pedido ya está pagado). Idempotente por
    // wonPaidTransition (una vez) + el extOrderId único de MiCorreo.
    let micorreoImport: { imported: boolean; detail: string } | undefined;
    try {
      const doImport = deps.autoImportShipment ?? ((o: AutoShipmentOrder) => autoImportShipmentImpl(o));
      const outcome = await doImport({
        orderNumber: order.orderNumber,
        contactName: order.contactName,
        contactEmail: order.contactEmail,
        contactPhone: order.contactPhone,
        shippingMethod: order.shippingMethod,
        shippingAddress: order.shippingAddress,
        weightGr: order.weightGr,
        declaredValue: toNumber(order.subtotal),
      });
      micorreoImport = { imported: outcome.imported, detail: outcome.detail };
      if (outcome.imported) {
        await deps.db.shipment.update({ where: { orderId: order.id }, data: { service: outcome.service, micorreoImportedAt: deps.now ?? new Date() } });
      } else {
        console.info(`[webhook] pedido ${order.orderNumber}: no auto-importado a MiCorreo (${outcome.detail})`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      micorreoImport = { imported: false, detail: msg };
      console.error(`[webhook] auto-import MiCorreo falló (pedido ${order.orderNumber}):`, msg);
    }

    // 6b. Emails. La alerta a la dueña incluye el resultado del auto-import (si falló, hay que
    // cargarlo a mano / reintentar desde el panel).
    // Best-effort, mismo criterio que 6a: el pago YA está confirmado en DB — un fallo de Resend
    // acá no debe voltear el webhook (si no, MP reintenta indefinidamente sobre un pago que ya
    // es idempotente, en vez de cerrar con 200).
    try {
      const emailData: OrderEmailData = {
        orderNumber: order.orderNumber, contactName: order.contactName, contactEmail: order.contactEmail,
        items: order.items.map((it) => ({ name: it.productNameSnapshot, variantName: it.variantNameSnapshot, qty: it.qty, lineTotal: toNumber(it.lineTotal) })),
        subtotal: toNumber(order.subtotal), shippingCost: toNumber(order.shippingCost), discountTotal: toNumber(order.discountTotal), total: toNumber(order.total),
        shippingMethod: order.shippingMethod,
        // Defensa: monto realmente acreditado por MP → la alerta a la dueña flaggea si no coincide con el total.
        amountPaid: mpPayment.transaction_amount ?? undefined,
      };
      const customer = orderConfirmationEmail(emailData);
      await deps.sendEmail({ to: order.contactEmail, subject: customer.subject, html: customer.html, text: customer.text });
      if (deps.ownerEmail) {
        const owner = newOrderAlertEmail({ ...emailData, oversoldLines: oversoldLines.length ? oversoldLines : undefined, micorreoImport });
        await deps.sendEmail({ to: deps.ownerEmail, subject: owner.subject, html: owner.html, text: owner.text });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[webhook] envío de emails falló (pedido ${order.orderNumber}):`, msg);
    }
  }

  return { status: 200, detail: wonPaidTransition ? "paid" : (effects.setOrderStatusTo === "paid" ? "ya pagado (idempotente)" : (effects.setOrderStatusTo ?? "sin cambio")) };
}
