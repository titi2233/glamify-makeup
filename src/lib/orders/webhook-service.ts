// NOTA: sin `import "server-only"` — lo importa scripts/simulate-mp-webhook.ts (node). Server por importar prisma.
import { prisma, type PrismaTransactionClient } from "@/lib/prisma";
import { verifyMpSignature } from "@/lib/payments/signature";
import { getPayment as realGetPayment, mpStatusToPaymentStatus } from "@/lib/payments/mercadopago";
import { decideWebhookEffects } from "@/lib/payments/webhook-effects";
import { computeStockDecrements, checkAvailability } from "@/lib/orders/stock";
import { sendEmail as realSendEmail } from "@/lib/email/resend";
import { orderConfirmationEmail, newOrderAlertEmail, type OrderEmailData } from "@/lib/email/templates";
import { toNumber } from "@/lib/catalog/pricing";
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
  orderNumber: string;
  status: OrderStatus;
  couponId: string | null;
  contactName: string;
  contactEmail: string;
  shippingMethod: string;
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
    await tx.payment.upsert({
      where: { mpPaymentId: String(mpPayment.id) },
      create: { orderId: order.id, provider: "mercadopago", mpPaymentId: String(mpPayment.id), status: effects.updatePaymentTo, amount: mpPayment.transaction_amount ?? toNumber(order.total), rawPayload: mpPayment as unknown as object },
      update: { status: effects.updatePaymentTo, rawPayload: mpPayment as unknown as object },
    });

    if (effects.setOrderStatusTo === "paid") {
      // Guarda ATÓMICA: updateMany con precondición de estado. READ COMMITTED no serializa dos
      // findFirst previos, pero sí esta escritura condicional → solo una invocación obtiene count 1.
      const res = await tx.order.updateMany({ where: { id: order.id, status: "pending_payment" }, data: { status: "paid" } });
      wonPaidTransition = res.count === 1;
    } else if (effects.setOrderStatusTo) {
      await tx.order.update({ where: { id: order.id }, data: { status: effects.setOrderStatusTo } });
    }

    // Efectos de una sola vez: SOLO si este webhook ganó la transición a paid.
    if (wonPaidTransition) {
      const lines = order.items.map(orderItemToLine);
      const decrements = computeStockDecrements(lines);
      const ids = [...decrements.keys()];
      const current = await tx.productVariant.findMany({ where: { id: { in: ids } }, select: { id: true, stock: true } });
      const stockMap = new Map<string, number>((current as Array<{ id: string; stock: number }>).map((v) => [v.id, v.stock]));
      const avail = checkAvailability(decrements, stockMap);
      for (const [variantId, qty] of decrements) {
        const have = stockMap.get(variantId) ?? 0;
        const dec = Math.min(have, qty); // no bajar de 0 (oversell)
        if (dec > 0) await tx.productVariant.update({ where: { id: variantId }, data: { stock: { decrement: dec } } });
      }
      if (!avail.ok) {
        oversoldLines = order.items
          .filter((it) => avail.shortages.some((s) => s.variantId === it.variantId))
          .map((it) => ({ name: it.variantNameSnapshot ? `${it.productNameSnapshot} (${it.variantNameSnapshot})` : it.productNameSnapshot }));
      }
      await tx.shipment.create({ data: { orderId: order.id, status: "pending", cost: toNumber(order.shippingCost) } });

      if (order.couponId) {
        await tx.coupon.update({ where: { id: order.couponId }, data: { usedCount: { increment: 1 } } });
      }
    }
  });

  // 6. Emails (fuera de tx) — solo si ganamos la transición a paid (una sola vez).
  if (wonPaidTransition) {
    const emailData: OrderEmailData = {
      orderNumber: order.orderNumber, contactName: order.contactName, contactEmail: order.contactEmail,
      items: order.items.map((it) => ({ name: it.productNameSnapshot, variantName: it.variantNameSnapshot, qty: it.qty, lineTotal: toNumber(it.lineTotal) })),
      subtotal: toNumber(order.subtotal), shippingCost: toNumber(order.shippingCost), discountTotal: toNumber(order.discountTotal), total: toNumber(order.total),
      shippingMethod: order.shippingMethod,
    };
    const customer = orderConfirmationEmail(emailData);
    await deps.sendEmail({ to: order.contactEmail, subject: customer.subject, html: customer.html, text: customer.text });
    if (deps.ownerEmail) {
      const owner = newOrderAlertEmail({ ...emailData, oversoldLines: oversoldLines.length ? oversoldLines : undefined });
      await deps.sendEmail({ to: deps.ownerEmail, subject: owner.subject, html: owner.html, text: owner.text });
    }
  }

  return { status: 200, detail: wonPaidTransition ? "paid" : (effects.setOrderStatusTo === "paid" ? "ya pagado (idempotente)" : (effects.setOrderStatusTo ?? "sin cambio")) };
}
