/**
 * Limpieza de datos de PRUEBA (seed) en la base.
 *
 * Borra SOLO lo que sembró `prisma/seed.ts`: los 12 productos de muestra,
 * el combo "Dúo Labios Glam", el pedido e2e GLM-E2E001 y (opcional) los
 * cupones genéricos de prueba. NO toca productos reales (otros slugs) ni el
 * historial de ventas reales: `OrderItem.variantId` es opcional → al borrar
 * una variante se nulea el FK pero se conservan los snapshots del pedido.
 *
 * Uso (desde el worktree, con .env apuntando a la base):
 *   pnpm db:cleanup                     # DRY-RUN: reporta, NO borra
 *   pnpm db:cleanup -- --apply          # borra de verdad (en una transacción)
 *   pnpm db:cleanup -- --apply --coupons  # además borra cupones de prueba
 *
 * Orden de borrado (FK-seguro): pedido e2e → combo → productos → cupones.
 * El combo se borra antes que los productos porque ComboItem.variantId es
 * requerido (onDelete por defecto = Restrict) y bloquearía el borrado.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const SEED_PRODUCT_SLUGS = [
  "labial-mate-larga-duracion",
  "gloss-brillo-humedo",
  "mascara-volumen-extremo",
  "paleta-sombras-glam-12",
  "rubor-compacto-sedoso",
  "base-fluida-hd",
  "set-brochas-x5",
  "delineador-liquido-precision",
  "iluminador-liquido-glow",
  "labial-cremoso-nude",
  "esponja-maquillaje-blender",
  "primer-facial-poro-cero",
];
const SEED_COMBO_SLUGS = ["duo-labios-glam"];
const SEED_ORDER_NUMBERS = ["GLM-E2E001"];
// BIENVENIDA10 NO está acá: es el cupón real del exit-intent (NEXT_PUBLIC_WELCOME_COUPON_CODE).
const SEED_COUPON_CODES = ["GLAM10", "BIENVENIDA", "ENVIOGRATIS"];

const apply = process.argv.includes("--apply");
const withCoupons = process.argv.includes("--coupons");

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ Falta DIRECT_URL/DATABASE_URL. Corré con: tsx --env-file=.env prisma/cleanup-seed.ts");
  process.exit(1);
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  console.log(apply ? "🧹 LIMPIEZA REAL (--apply)" : "🔎 DRY-RUN (no borra nada). Agregá --apply para borrar.");
  console.log("");

  const products = await prisma.product.findMany({
    where: { slug: { in: SEED_PRODUCT_SLUGS } },
    select: { id: true, slug: true, name: true, _count: { select: { variants: true, reviews: true, wishlistedBy: true } } },
  });
  const productIds = products.map((p) => p.id);
  const variants = await prisma.productVariant.findMany({ where: { productId: { in: productIds } }, select: { id: true } });
  const variantIds = variants.map((v) => v.id);

  const combos = await prisma.combo.findMany({ where: { slug: { in: SEED_COMBO_SLUGS } }, select: { id: true, slug: true, name: true } });
  const orders = await prisma.order.findMany({ where: { orderNumber: { in: SEED_ORDER_NUMBERS } }, select: { id: true, orderNumber: true } });
  const coupons = await prisma.coupon.findMany({ where: { code: { in: SEED_COUPON_CODES } }, select: { id: true, code: true } });

  // Datos REALES que se verían afectados (transparencia antes de borrar):
  const cartItemsAffected = await prisma.cartItem.count({ where: { variantId: { in: variantIds } } });
  const orderItemsAffected = await prisma.orderItem.count({
    where: { variantId: { in: variantIds }, orderId: { notIn: orders.map((o) => o.id) } },
  });
  const reviewsCascade = products.reduce((n, p) => n + p._count.reviews, 0);
  const wishlistCascade = products.reduce((n, p) => n + p._count.wishlistedBy, 0);
  const variantsCascade = products.reduce((n, p) => n + p._count.variants, 0);

  // Pre-check de seguridad: ¿algún combo REAL (no-seed) usa una variante que vamos a borrar?
  // ComboItem.variantId es Restrict → ese borrado fallaría. Abortamos con detalle.
  const blockingComboItems = await prisma.comboItem.findMany({
    where: { variantId: { in: variantIds }, combo: { slug: { notIn: SEED_COMBO_SLUGS } } },
    select: { combo: { select: { slug: true, name: true } }, variant: { select: { sku: true, name: true } } },
  });

  console.log(`Productos seed a borrar: ${products.length}/${SEED_PRODUCT_SLUGS.length}`);
  for (const p of products) console.log(`  - ${p.slug} (${p.name}) — ${p._count.variants} variantes`);
  console.log(`Combo seed: ${combos.map((c) => c.slug).join(", ") || "(ninguno)"}`);
  console.log(`Pedido e2e: ${orders.map((o) => o.orderNumber).join(", ") || "(ninguno)"}`);
  console.log(`Cupones de prueba: ${withCoupons ? coupons.map((c) => c.code).join(", ") || "(ninguno)" : "(omitidos — usá --coupons)"}`);
  console.log("");
  console.log("Efecto colateral (en cascada por FK):");
  console.log(`  · ${variantsCascade} variantes (Cascade)`);
  console.log(`  · ${reviewsCascade} reseñas y ${wishlistCascade} wishlist sobre esos productos (Cascade)`);
  console.log(`  · ${cartItemsAffected} ítems de carrito y ${orderItemsAffected} ítems de pedidos REALES → variantId nulo (snapshots intactos)`);
  console.log("");

  if (blockingComboItems.length > 0) {
    console.error("⛔ ABORTADO: un combo REAL usa variantes de productos seed. Resolvé esto a mano primero:");
    for (const ci of blockingComboItems) console.error(`   combo "${ci.combo.slug}" usa ${ci.variant.sku} (${ci.variant.name})`);
    process.exit(1);
  }

  if (!apply) {
    console.log("DRY-RUN: nada borrado. Repetí con `-- --apply` (y `--coupons` si querés borrar los cupones).");
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const delOrders = await tx.order.deleteMany({ where: { orderNumber: { in: SEED_ORDER_NUMBERS } } });
    const delCombos = await tx.combo.deleteMany({ where: { slug: { in: SEED_COMBO_SLUGS } } });
    const delProducts = await tx.product.deleteMany({ where: { slug: { in: SEED_PRODUCT_SLUGS } } });
    const delCoupons = withCoupons ? await tx.coupon.deleteMany({ where: { code: { in: SEED_COUPON_CODES } } }) : { count: 0 };
    return { delOrders, delCombos, delProducts, delCoupons };
  });

  console.log("✅ Borrado completo:");
  console.log(`   ${result.delOrders.count} pedido(s), ${result.delCombos.count} combo(s), ${result.delProducts.count} producto(s), ${result.delCoupons.count} cupón(es).`);
}

main()
  .catch((e) => {
    console.error("❌ Limpieza falló:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
