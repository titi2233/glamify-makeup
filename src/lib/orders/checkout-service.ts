// NOTA: sin `import "server-only"` — lo importa scripts/simulate-mp-webhook.ts (node). Server por importar prisma.
import { prisma, type PrismaTransactionClient } from "@/lib/prisma";
import { round2 } from "@/lib/money";
import { cartSubtotal } from "@/lib/cart/totals";
import { lineTotal } from "@/lib/cart/totals";
import { validateCoupon, applyCoupon } from "@/lib/coupons/apply";
import { formatOrderNumber } from "@/lib/orders/order-number";
import { createPreference as realCreatePreference } from "@/lib/payments/mercadopago";
import { quoteShipping as realQuoteShipping, type ShippingQuote } from "@/lib/shipping/index";
import { getShippingZonesForQuote, getFreeShippingThreshold } from "@/lib/orders/checkout-data";
import type { CartLine } from "@/lib/cart/types";

export interface CheckoutLineInput {
  line: CartLine;
  productNameSnapshot: string;
  variantNameSnapshot: string | null;
  skuSnapshot: string | null;
  title: string;
}
export interface CheckoutAddress {
  cp: string;
  province?: string | null;
  street?: string;
  number?: string;
  floorApt?: string | null;
  city?: string;
  notes?: string | null;
}
export interface CreateCheckoutInput {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  shippingMethod: "domicilio" | "sucursal";
  address: CheckoutAddress;
  lines: CheckoutLineInput[];
  couponCode?: string | null;
  customerId?: string | null;
  cartId?: string | null;
}

/** Interfaz mínima de coupon row necesaria para validar y aplicar. */
export interface CouponRow {
  id: string;
  code: string;
  type: "percentage" | "fixed" | "free_shipping";
  value: number | string;
  scope: "all" | "category" | "product";
  scopeId: string | null;
  active: boolean;
  minSubtotal: number | string | null;
  validFrom: Date | null;
  validTo: Date | null;
  maxUses: number | null;
  usedCount: number;
  perCustomerLimit: number | null;
}

/** Superficie mínima de DB que necesita el servicio (para inyectar fakes en tests). */
export interface CheckoutDb {
  coupon: { findUnique: (args: { where: { code: string } }) => Promise<CouponRow | null> };
  couponRedemption: {
    findUnique: (args: { where: { customerId_couponId: { customerId: string; couponId: string } } }) => Promise<{ redeemedCount: number } | null>;
  };
  $transaction: <T>(fn: (tx: PrismaTransactionClient) => Promise<T>) => Promise<T>;
}
export interface CreateCheckoutDeps {
  db: CheckoutDb;
  nextOrderSeq: (tx: PrismaTransactionClient) => Promise<number>;
  createPreference: typeof realCreatePreference;
  quoteShipping: (input: Parameters<typeof realQuoteShipping>[0]) => Promise<ShippingQuote>;
  appUrl: string;
  /** true si MP_ACCESS_TOKEN es de sandbox (TEST-...) — decide qué init_point devolver. */
  isSandboxToken: boolean;
  now?: Date;
}
export interface CreateCheckoutResult {
  orderId: string;
  orderNumber: string;
  initPoint: string;
}

/** Lee la secuencia order_number_seq dentro de la tx (default real). */
async function defaultNextOrderSeq(tx: PrismaTransactionClient): Promise<number> {
  const rows = (await tx.$queryRawUnsafe("SELECT nextval('order_number_seq') AS seq")) as Array<{ seq: bigint | number }>;
  return Number(rows[0].seq);
}

export function defaultCheckoutDeps(appUrl: string): CreateCheckoutDeps {
  return {
    db: prisma as unknown as CheckoutDb,
    nextOrderSeq: defaultNextOrderSeq,
    createPreference: realCreatePreference,
    quoteShipping: (input) => realQuoteShipping(input, { getZones: getShippingZonesForQuote, getThreshold: getFreeShippingThreshold }),
    appUrl,
    isSandboxToken: process.env.MP_ACCESS_TOKEN?.startsWith("TEST-") ?? false,
  };
}

export async function createCheckout(input: CreateCheckoutInput, deps: CreateCheckoutDeps): Promise<CreateCheckoutResult> {
  if (input.lines.length === 0) throw new Error("El carrito está vacío.");
  const now = deps.now ?? new Date();
  const cartLines = input.lines.map((l) => l.line);
  const subtotal = cartSubtotal(cartLines);

  // --- Cupón (revalidado en server) ---
  let discount = 0;
  let freeShippingByCoupon = false;
  let couponId: string | null = null;
  if (input.couponCode) {
    const coupon = await deps.db.coupon.findUnique({ where: { code: input.couponCode } });
    if (coupon) {
      let customerRedemptions = 0;
      if (input.customerId && coupon.perCustomerLimit != null) {
        const r = await deps.db.couponRedemption.findUnique({
          where: { customerId_couponId: { customerId: input.customerId, couponId: coupon.id } },
        });
        customerRedemptions = r?.redeemedCount ?? 0;
      }
      const v = validateCoupon(coupon, { subtotal, now, customerRedemptions });
      if (v.ok) {
        const res = applyCoupon(coupon, cartLines);
        discount = res.discount;
        freeShippingByCoupon = res.freeShipping;
        couponId = coupon.id;
      }
    }
  }

  // --- Envío ---
  const quote = await deps.quoteShipping({
    cp: input.address.cp, province: input.address.province ?? null, city: input.address.city ?? null,
    method: input.shippingMethod, lines: cartLines, subtotal,
  });
  const shippingCost = freeShippingByCoupon ? 0 : quote.cost;
  const total = round2(subtotal - discount + shippingCost);

  // --- Persistencia (tx) ---
  const order = await deps.db.$transaction(async (tx) => {
    const seq = await deps.nextOrderSeq(tx);
    const orderNumber = formatOrderNumber(seq);
    const created = await tx.order.create({
      data: {
        orderNumber,
        customerId: input.customerId ?? null,
        contactName: input.contactName, contactEmail: input.contactEmail, contactPhone: input.contactPhone,
        shippingAddress: input.address as unknown as object,
        shippingMethod: input.shippingMethod,
        shippingZoneId: quote.zoneId,
        subtotal, shippingCost, discountTotal: discount, total,
        couponId,
        status: "pending_payment",
        items: {
          create: input.lines.map((l) => ({
            variantId: l.line.kind === "variant" ? l.line.refId : null,
            comboId: l.line.kind === "combo" ? l.line.refId : null,
            productNameSnapshot: l.productNameSnapshot,
            variantNameSnapshot: l.variantNameSnapshot,
            skuSnapshot: l.skuSnapshot,
            unitPriceSnapshot: l.line.unitPrice,
            qty: l.line.qty,
            lineTotal: lineTotal(l.line),
          })),
        },
        payments: { create: { provider: "mercadopago", status: "pending", amount: total } },
      },
      include: { payments: true },
    });
    if (input.cartId) await tx.cart.update({ where: { id: input.cartId }, data: { status: "ordered" } });
    return created;
  });

  // --- Preference MP ---
  // CRÍTICO: los ítems enviados a MP DEBEN sumar exactamente `total` (lo que MP le cobra a la clienta).
  // Sin descuento: ítems de producto + línea de envío (todo positivo → suma = subtotal + envío = total).
  // Con descuento: una sola línea consolidada = total (MP no acepta líneas de precio negativo de forma confiable).
  const mpItems =
    discount > 0
      ? [{ title: `Glamify Makeup · Pedido ${order.orderNumber}`, quantity: 1, unit_price: total }]
      : [
          ...input.lines.map((l) => ({ title: l.title, quantity: l.line.qty, unit_price: l.line.unitPrice })),
          ...(shippingCost > 0 ? [{ title: "Envío", quantity: 1, unit_price: shippingCost }] : []),
        ];
  const preference = await deps.createPreference({
    orderId: order.id, orderNumber: order.orderNumber,
    items: mpItems,
    payerEmail: input.contactEmail,
    appUrl: deps.appUrl,
    notificationUrl: `${deps.appUrl}/api/webhooks/mercadopago`,
  });

  await deps.db.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: order.payments[0].id }, data: { mpPreferenceId: preference.id } });
  });

  const initPoint = deps.isSandboxToken && preference.sandbox_init_point
    ? preference.sandbox_init_point
    : preference.init_point;

  return { orderId: order.id, orderNumber: order.orderNumber, initPoint };
}
