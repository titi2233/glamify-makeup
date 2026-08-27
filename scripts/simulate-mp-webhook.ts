import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createHmac } from "node:crypto";
import { createCheckout } from "../src/lib/orders/checkout-service";
import { processWebhook } from "../src/lib/orders/webhook-service";
import { getShippingZonesForQuote, getFreeShippingThreshold } from "../src/lib/orders/checkout-data";
import { quoteShipping } from "../src/lib/shipping/index";
import { sendEmail } from "../src/lib/email/resend";
import { verifyMpSignature } from "../src/lib/payments/signature";
import { toNumber } from "../src/lib/catalog/pricing";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SECRET = process.env.MP_WEBHOOK_SECRET || "dev_webhook_secret";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function buildSignature(dataId: string, requestId: string, ts: string): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return `ts=${ts},v1=${createHmac("sha256", SECRET).update(manifest).digest("hex")}`;
}

async function main(): Promise<void> {
  const qty = 2;
  const variant = await prisma.productVariant.findFirst({ where: { stock: { gt: qty }, active: true }, include: { product: true } });
  if (!variant) throw new Error("No hay variante con stock suficiente para simular. Corré `pnpm db:seed`.");
  const stockBefore = variant.stock;

  // 1) Crear pedido (preference fake; resto real contra la DB).
  const line = {
    id: "sim", kind: "variant" as const, refId: variant.id,
    unitPrice: toNumber(variant.priceOverride ?? variant.product.basePrice), qty,
    weightGr: variant.weightGrOverride ?? variant.product.weightGr,
    productId: variant.productId, categoryId: variant.product.categoryId,
  };
  const { orderId, orderNumber } = await createCheckout(
    {
      contactName: "Simulación", contactEmail: "sim@example.com", contactPhone: "1100000000",
      shippingMethod: "domicilio", address: { cp: "1414", province: "CABA", street: "Calle", number: "1", city: "CABA" },
      lines: [{ line, productNameSnapshot: variant.product.name, variantNameSnapshot: variant.name, skuSnapshot: variant.sku, title: `${variant.product.name} — ${variant.name}` }],
      couponCode: null,
    },
    {
      db: prisma as any,
      nextOrderSeq: async (tx: any) => Number((await tx.$queryRawUnsafe("SELECT nextval('order_number_seq') AS seq"))[0].seq),
      createPreference: async () => ({ id: "pref-sim", init_point: "sim", sandbox_init_point: "sim" }),
      quoteShipping: (i) => quoteShipping(i, { getZones: getShippingZonesForQuote, getThreshold: getFreeShippingThreshold }),
      appUrl: APP_URL,
      isSandboxToken: process.env.MP_ACCESS_TOKEN?.startsWith("TEST-") ?? false,
    },
  );
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  console.log(`🧾 Pedido ${orderNumber} creado (${variant.product.name} — ${variant.name} ×${qty}). Stock inicial: ${stockBefore}.`);

  // 2) Webhook approved (firma válida) × 2.
  const dataId = `SIM-${order!.createdAt.getTime()}`;
  const requestId = "sim-req-1";
  const input = { dataId, xSignature: buildSignature(dataId, requestId, "1717500000"), xRequestId: requestId };
  const deps = {
    db: prisma as any,
    getPayment: async () => ({ id: dataId, status: "approved", external_reference: orderId, transaction_amount: toNumber(order!.total) }),
    sendEmail, verifySignature: verifyMpSignature, secret: SECRET, ownerEmail: process.env.RESEND_OWNER_EMAIL || "",
    // No-op en la simulación: no crear un envío real en MiCorreo por un pedido de prueba.
    autoImportShipment: async () => ({ imported: false as const, detail: "simulación" }),
  };

  const r1 = await processWebhook(input, deps);
  const after1 = await prisma.productVariant.findUnique({ where: { id: variant.id } });
  const r2 = await processWebhook(input, deps);
  const after2 = await prisma.productVariant.findUnique({ where: { id: variant.id } });
  const paid = await prisma.order.findUnique({ where: { id: orderId } });

  console.log(`📨 Webhook #1: ${r1.status} (${r1.detail}) → stock ${stockBefore} → ${after1!.stock}`);
  console.log(`📨 Webhook #2 (repetido): ${r2.status} (${r2.detail}) → stock ${after2!.stock}`);
  console.log(`📦 Estado del pedido: ${paid!.status}`);

  const ok = paid!.status === "paid" && after1!.stock === stockBefore - qty && after2!.stock === after1!.stock;
  console.log(ok ? "✅ DoD: pago acreditado, stock bajó UNA sola vez (idempotente)." : "❌ FALLO: revisar idempotencia/stock.");
  if (!ok) process.exitCode = 1;
}

main()
  .catch((e) => { console.error("❌ Simulación falló:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
