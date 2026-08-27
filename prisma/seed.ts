import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateSku } from "../src/lib/sku";
import { confirmProdWrite } from "../scripts/prod-write-guard";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ---- Catálogo de prueba (dev/preview). "No humo": stock y ofertas con datos reales. ----

interface SeedCategory {
  slug: string;
  name: string;
  skuPrefix: string;
  order: number;
  image?: string;
  children?: SeedCategory[];
}

const CATEGORIES: SeedCategory[] = [
  { slug: "brochas-y-esponjas", name: "Brochas y Esponjas", skuPrefix: "BRO", order: 0, image: "/images/category_brochas_esponjas.jpg" },
  { slug: "rubor", name: "Rubor", skuPrefix: "RUB", order: 1, image: "/images/category_rubor.jpg" },
  { slug: "iluminador", name: "Iluminador", skuPrefix: "ILU", order: 2, image: "/images/category_iluminador.jpg" },
  { slug: "pestanas", name: "Pestañas", skuPrefix: "PES", order: 3, image: "/images/category_pestanas.jpg" },
  { slug: "labios", name: "Labios", skuPrefix: "LAB", order: 4, image: "/images/category_labios.jpg" },
  { slug: "delineador", name: "Delineador", skuPrefix: "DEL", order: 5, image: "/images/category_delineador.jpg" },
  { slug: "bases-y-correctores", name: "Bases y Correctores", skuPrefix: "BAS", order: 6, image: "/images/category_bases_correctores.jpg" },
  { slug: "contorno", name: "Contorno", skuPrefix: "CON", order: 7, image: "/images/category_contorno.jpg" },
  { slug: "otros", name: "Otros", skuPrefix: "OTR", order: 8, image: "/images/category_otros.jpg" },
];

interface SeedVariant {
  name: string;
  swatchHex?: string;
  stock: number;
  lowStockThreshold?: number;
  priceOverride?: number;
}
interface SeedProduct {
  slug: string;
  name: string;
  categorySlug: string; // subcategoría (hoja)
  description: string;
  basePrice: number;
  compareAtPrice?: number; // solo si > basePrice (oferta real)
  cost: number;
  weightGr: number;
  isFeatured?: boolean;
  heroRank?: number;
  tags?: string[];
  images?: string[];
  variants: SeedVariant[];
}

const PRODUCTS: SeedProduct[] = [
  {
    slug: "labial-mate-larga-duracion", name: "Labial Mate Larga Duración", categorySlug: "labios",
    description: "Color intenso que dura todo el día, acabado mate aterciopelado y cómodo.",
    basePrice: 3200, compareAtPrice: 3990, cost: 1400, weightGr: 25, isFeatured: true, heroRank: 1, tags: ["mate", "larga duración"],
    images: ["/images/product_lipstick.png"],
    variants: [
      { name: "Rojo Pasión", swatchHex: "#C0392B", stock: 18 },
      { name: "Fucsia Glam", swatchHex: "#FF2E93", stock: 9 },
      { name: "Nude Rosado", swatchHex: "#C8A27C", stock: 2, lowStockThreshold: 3 },
      { name: "Vino", swatchHex: "#6E0B3F", stock: 0 },
    ],
  },
  {
    slug: "gloss-brillo-humedo", name: "Gloss Brillo Húmedo", categorySlug: "labios",
    description: "Brillo espejo no pegajoso con un toque de color. Efecto labios jugosos.",
    basePrice: 2500, cost: 1000, weightGr: 22, isFeatured: true, heroRank: 2, tags: ["brillo"],
    images: ["/images/product_lipstick.png"],
    variants: [
      { name: "Transparente", swatchHex: "#F4E7EE", stock: 25 },
      { name: "Rosa Bebé", swatchHex: "#FF9ED1", stock: 14 },
      { name: "Coral", swatchHex: "#FF7F6E", stock: 6 },
    ],
  },
  {
    slug: "mascara-volumen-extremo", name: "Máscara de Pestañas Volumen Extremo", categorySlug: "pestanas",
    description: "Pestañas con volumen dramático sin grumos. Cepillo de fibras finas.",
    basePrice: 4100, cost: 1800, weightGr: 30, isFeatured: true, heroRank: 3, tags: ["volumen"],
    images: ["/images/product_mascara.png"],
    variants: [
      { name: "Negro Intenso", swatchHex: "#111111", stock: 20 },
      { name: "Marrón", swatchHex: "#5B3A29", stock: 3, lowStockThreshold: 3 },
    ],
  },
  {
    slug: "paleta-sombras-glam-12", name: "Paleta de Sombras Glam 12 Tonos", categorySlug: "otros",
    description: "12 tonos mate y shimmer altamente pigmentados para looks de día y noche.",
    basePrice: 6900, compareAtPrice: 8500, cost: 3000, weightGr: 120, isFeatured: true, heroRank: 4, tags: ["paleta", "shimmer"],
    images: ["/images/product_eyeshadow.png"],
    variants: [{ name: "Único", swatchHex: "#C8A27C", stock: 11 }],
  },
  {
    slug: "rubor-compacto-sedoso", name: "Rubor Compacto Sedoso", categorySlug: "rubor",
    description: "Color natural y difuminable, acabado satinado que ilumina el rostro.",
    basePrice: 2990, cost: 1200, weightGr: 28, tags: ["rubor"],
    images: ["/images/product_blush.png"],
    variants: [
      { name: "Durazno", swatchHex: "#F4A07A", stock: 16 },
      { name: "Rosa Suave", swatchHex: "#FF9ED1", stock: 8 },
      { name: "Coral Cálido", swatchHex: "#FF7F6E", stock: 1, lowStockThreshold: 3 },
    ],
  },
  {
    slug: "base-fluida-hd", name: "Base Fluida HD", categorySlug: "bases-y-correctores",
    description: "Cobertura media a alta, acabado natural HD de larga duración.",
    basePrice: 5500, cost: 2400, weightGr: 60, tags: ["base", "hd"],
    images: ["/images/product_foundation.png"],
    variants: [
      { name: "Tono 01 Claro", swatchHex: "#F2D6C2", stock: 12 },
      { name: "Tono 02 Natural", swatchHex: "#E3B89A", stock: 12 },
      { name: "Tono 03 Medio", swatchHex: "#C99572", stock: 7 },
      { name: "Tono 04 Tostado", swatchHex: "#A66B47", stock: 4 },
    ],
  },
  {
    slug: "set-brochas-x5", name: "Set de Brochas Profesionales x5", categorySlug: "brochas-y-esponjas",
    description: "5 brochas esenciales de cerda suave para rostro y ojos. Incluye estuche.",
    basePrice: 7800, compareAtPrice: 9900, cost: 3500, weightGr: 200, tags: ["set", "brochas", "order-bump"],
    images: ["/images/product_brushes.png"],
    variants: [{ name: "Rosa", swatchHex: "#FF2E93", stock: 5 }],
  },
  {
    slug: "delineador-liquido-precision", name: "Delineador Líquido Precisión", categorySlug: "delineador",
    description: "Punta ultrafina para un trazo preciso. Negro intenso a prueba de smudge.",
    basePrice: 3300, cost: 1300, weightGr: 18, tags: ["delineador"],
    images: ["/images/product_mascara.png"],
    variants: [{ name: "Negro", swatchHex: "#111111", stock: 22 }],
  },
  {
    slug: "iluminador-liquido-glow", name: "Iluminador Líquido Glow", categorySlug: "iluminador",
    description: "Glow húmedo de acabado dorado-rosado. Solo o mezclado con la base.",
    basePrice: 4200, cost: 1700, weightGr: 35, tags: ["glow", "iluminador"],
    images: ["/images/product_blush.png"],
    variants: [
      { name: "Champagne", swatchHex: "#EAD3A2", stock: 10 },
      { name: "Oro Rosa", swatchHex: "#E6B7A9", stock: 0 },
    ],
  },
  {
    slug: "labial-cremoso-nude", name: "Labial Cremoso Nude", categorySlug: "labios",
    description: "Textura cremosa hidratante con tonos nude versátiles para todos los días.",
    basePrice: 3000, cost: 1250, weightGr: 24, tags: ["cremoso", "nude"],
    images: ["/images/product_lipstick.png"],
    variants: [
      { name: "Nude Cálido", swatchHex: "#C8927A", stock: 13 },
      { name: "Rosa Maquillaje", swatchHex: "#D98E9E", stock: 9 },
      { name: "Caramelo", swatchHex: "#B97A52", stock: 2, lowStockThreshold: 3 },
    ],
  },
  {
    slug: "esponja-maquillaje-blender", name: "Esponja de Maquillaje Blender", categorySlug: "brochas-y-esponjas",
    description: "Esponja sin látex que difumina la base para un acabado impecable.",
    basePrice: 1800, cost: 600, weightGr: 12, tags: ["esponja", "order-bump"],
    images: ["/images/product_brushes.png"],
    variants: [
      { name: "Rosa", swatchHex: "#FF9ED1", stock: 30 },
      { name: "Violeta", swatchHex: "#8B5CF6", stock: 17 },
    ],
  },
  {
    slug: "primer-facial-poro-cero", name: "Primer Facial Poro Cero", categorySlug: "bases-y-correctores",
    description: "Prebase matificante que difumina poros y prolonga la duración del maquillaje.",
    basePrice: 4800, cost: 2000, weightGr: 40, tags: ["primer"],
    images: ["/images/product_foundation.png"],
    variants: [{ name: "Único", swatchHex: "#F4E7EE", stock: 6 }],
  },
];

async function upsertCategories(): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();
  for (const parent of CATEGORIES) {
    const p = await prisma.category.upsert({
      where: { slug: parent.slug },
      update: { name: parent.name, skuPrefix: parent.skuPrefix, order: parent.order, image: parent.image ?? null, parentId: null, active: true },
      create: { slug: parent.slug, name: parent.name, skuPrefix: parent.skuPrefix, order: parent.order, image: parent.image ?? null },
    });
    idBySlug.set(parent.slug, p.id);
  }
  return idBySlug;
}

function prefixForSlug(slug: string): string {
  for (const parent of CATEGORIES) {
    if (parent.slug === slug) return parent.skuPrefix;
  }
  throw new Error(`Sin skuPrefix para categoría ${slug}`);
}

async function upsertProducts(idBySlug: Map<string, string>): Promise<void> {
  const seqByPrefix = new Map<string, number>();
  for (const p of PRODUCTS) {
    const categoryId = idBySlug.get(p.categorySlug);
    if (!categoryId) throw new Error(`Categoría inexistente: ${p.categorySlug}`);
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name, description: p.description, categoryId,
        basePrice: p.basePrice, compareAtPrice: p.compareAtPrice ?? null, cost: p.cost, weightGr: p.weightGr,
        isFeatured: p.isFeatured ?? false, heroRank: p.heroRank ?? null, tags: p.tags ?? [], active: true, deletedAt: null,
        images: p.images ?? [],
      },
      create: {
        slug: p.slug, name: p.name, description: p.description, categoryId,
        basePrice: p.basePrice, compareAtPrice: p.compareAtPrice ?? null, cost: p.cost, weightGr: p.weightGr,
        isFeatured: p.isFeatured ?? false, heroRank: p.heroRank ?? null, tags: p.tags ?? [],
        images: p.images ?? [],
      },
    });
    const prefix = prefixForSlug(p.categorySlug);
    let order = 0;
    for (const v of p.variants) {
      const seq = (seqByPrefix.get(prefix) ?? 0) + 1;
      seqByPrefix.set(prefix, seq);
      const sku = generateSku(prefix, seq);
      const data: Prisma.ProductVariantUncheckedCreateInput = {
        productId: product.id, name: v.name, sku, swatchHex: v.swatchHex ?? null,
        priceOverride: v.priceOverride ?? null, stock: v.stock, lowStockThreshold: v.lowStockThreshold ?? 3,
        active: true, order: order++,
      };
      await prisma.productVariant.upsert({ where: { sku }, update: { ...data }, create: { ...data } });
    }
  }
}

// ---- M2: cupones, zonas de envío, ajustes, combo ----

async function upsertSettings(): Promise<void> {
  await prisma.setting.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      storeName: "Glamify Makeup",
      freeShippingThreshold: 47500,
      originPostalCode: "6700",
      whatsappNumber: "5491100000000",
      instagramUrl: "https://instagram.com/glamifymakeup",
    },
  });
}

interface SeedZone {
  name: string;
  matchType: "province" | "cpRange";
  provinces?: string[];
  cpFrom?: string;
  cpTo?: string;
  price: number;
  order: number;
}
const ZONES: SeedZone[] = [
  // Precios a domicilio (methodFactor aplica el descuento de sucursal, ver quote.ts). Recalibrados
  // con cotizaciones reales en vivo de MiCorreo PAQ.AR Clásico — ver docs/decisions/0001-shipping-provider.md.
  { name: "AMBA (CABA + GBA)", matchType: "cpRange", cpFrom: "1000", cpTo: "1900", price: 9000, order: 0 },
  { name: "Buenos Aires interior", matchType: "province", provinces: ["Buenos Aires"], price: 9000, order: 1 },
  { name: "Centro (Córdoba, Santa Fe, Entre Ríos)", matchType: "province", provinces: ["Córdoba", "Santa Fe", "Entre Ríos"], price: 9000, order: 2 },
  { name: "Resto del país", matchType: "cpRange", cpFrom: "0", cpTo: "9999", price: 10000, order: 3 },
];

async function upsertZones(): Promise<void> {
  // ShippingZone no tiene unique natural; limpiamos y recreamos (idempotente para dev).
  await prisma.shippingZone.deleteMany({});
  for (const z of ZONES) {
    await prisma.shippingZone.create({
      data: {
        name: z.name, matchType: z.matchType, provinces: z.provinces ?? [],
        cpFrom: z.cpFrom ?? null, cpTo: z.cpTo ?? null, price: z.price, order: z.order, active: true,
      },
    });
  }
}

interface SeedCoupon {
  code: string;
  type: "percentage" | "fixed" | "free_shipping";
  value: number;
  scope?: "all" | "category" | "product";
  minSubtotal?: number;
  maxUses?: number;
  perCustomerLimit?: number;
}
const COUPONS: SeedCoupon[] = [
  { code: "GLAM10", type: "percentage", value: 10, scope: "all" },
  { code: "BIENVENIDA", type: "fixed", value: 1000, scope: "all", minSubtotal: 5000 },
  { code: "ENVIOGRATIS", type: "free_shipping", value: 0, scope: "all" },
  // Cupón del exit-intent (NEXT_PUBLIC_WELCOME_COUPON_CODE). 1ª compra: 10% off, 1 uso por clienta.
  { code: "BIENVENIDA10", type: "percentage", value: 10, scope: "all", perCustomerLimit: 1 },
];

async function upsertCoupons(): Promise<void> {
  for (const c of COUPONS) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: { type: c.type, value: c.value, scope: c.scope ?? "all", minSubtotal: c.minSubtotal ?? null, maxUses: c.maxUses ?? null, perCustomerLimit: c.perCustomerLimit ?? null, active: true },
      create: { code: c.code, type: c.type, value: c.value, scope: c.scope ?? "all", minSubtotal: c.minSubtotal ?? null, maxUses: c.maxUses ?? null, perCustomerLimit: c.perCustomerLimit ?? null },
    });
  }
}

// ---- M3: pedido de muestra para el e2e del panel admin (idempotente) ----

const E2E_ORDER_NUMBER = "GLM-E2E001";

async function upsertE2eOrder(): Promise<void> {
  // Clienta e2e (si fue seedeada con `pnpm customer:create`): vincula el pedido a su cuenta
  // para que pueda dejar una reseña con compra verificada sobre el producto del pedido.
  const e2eEmail = process.env.CUSTOMER_EMAIL?.trim().toLowerCase() ?? "clienta.e2e@example.com";
  const e2eCustomer = await prisma.customer.findUnique({ where: { email: e2eEmail } });

  // Variante real del seed para snapshots coherentes.
  const variant = await prisma.productVariant.findFirst({
    where: { product: { slug: "labial-mate-larga-duracion" }, stock: { gt: 0 } },
    orderBy: { order: "asc" },
    include: { product: true },
  });
  if (!variant) {
    console.warn("⚠️  Pedido e2e no creado: falta variante con stock.");
    return;
  }

  const unitPrice = Number(variant.priceOverride ?? variant.product.basePrice);
  const qty = 1;
  const subtotal = unitPrice * qty;
  const shippingCost = 2500;
  const total = subtotal + shippingCost;

  const existing = await prisma.order.findUnique({ where: { orderNumber: E2E_ORDER_NUMBER } });

  const order = existing
    ? await prisma.order.update({
        where: { orderNumber: E2E_ORDER_NUMBER },
        data: {
          customerId: e2eCustomer?.id ?? null,
          contactName: "Clienta E2E",
          contactEmail: "e2e@example.com",
          contactPhone: "1100000000",
          shippingAddress: {
            cp: "1414", province: "CABA",
            street: "Calle Falsa", number: "123", floorApt: null, city: "CABA", notes: null,
          },
          shippingMethod: "domicilio",
          subtotal, shippingCost, discountTotal: 0, total,
          status: "paid",
        },
      })
    : await prisma.order.create({
        data: {
          orderNumber: E2E_ORDER_NUMBER,
          customerId: e2eCustomer?.id ?? null,
          contactName: "Clienta E2E",
          contactEmail: "e2e@example.com",
          contactPhone: "1100000000",
          shippingAddress: {
            cp: "1414", province: "CABA",
            street: "Calle Falsa", number: "123", floorApt: null, city: "CABA", notes: null,
          },
          shippingMethod: "domicilio",
          subtotal, shippingCost, discountTotal: 0, total,
          status: "paid",
        },
      });

  // Recrear el único item (snapshots) de forma idempotente.
  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  await prisma.orderItem.create({
    data: {
      orderId: order.id,
      variantId: variant.id,
      productNameSnapshot: variant.product.name,
      variantNameSnapshot: variant.name,
      skuSnapshot: variant.sku,
      unitPriceSnapshot: unitPrice,
      qty,
      lineTotal: subtotal,
    },
  });

  // Pago aprobado de muestra (idempotente por orderId; recreamos).
  await prisma.payment.deleteMany({ where: { orderId: order.id } });
  await prisma.payment.create({
    data: { orderId: order.id, provider: "mercadopago", status: "approved", amount: total },
  });
}

async function upsertCombo(): Promise<void> {
  // Combo "Dúo Labios Glam": 1 labial mate + 1 gloss. Descuenta stock de sus componentes al pagarse.
  const labial = await prisma.productVariant.findFirst({ where: { product: { slug: "labial-mate-larga-duracion" }, stock: { gt: 0 } }, orderBy: { order: "asc" } });
  const gloss = await prisma.productVariant.findFirst({ where: { product: { slug: "gloss-brillo-humedo" }, stock: { gt: 0 } }, orderBy: { order: "asc" } });
  if (!labial || !gloss) { console.warn("⚠️  Combo no creado: faltan variantes con stock."); return; }
  const combo = await prisma.combo.upsert({
    where: { slug: "duo-labios-glam" },
    update: { name: "Dúo Labios Glam", description: "Labial mate + gloss a precio especial.", comboPrice: 4990, active: true },
    create: { slug: "duo-labios-glam", name: "Dúo Labios Glam", description: "Labial mate + gloss a precio especial.", comboPrice: 4990, images: [] },
  });
  await prisma.comboItem.deleteMany({ where: { comboId: combo.id } });
  await prisma.comboItem.createMany({ data: [{ comboId: combo.id, variantId: labial.id, qty: 1 }, { comboId: combo.id, variantId: gloss.id, qty: 1 }] });
}

async function main(): Promise<void> {
  await confirmProdWrite("sembrar el catálogo de prueba (borra y recrea zonas de envío, crea el pedido GLM-E2E001)");
  console.log("🌱 Seeding catálogo Glamify Makeup…");
  const idBySlug = await upsertCategories();
  await upsertProducts(idBySlug);
  await upsertSettings();
  await upsertZones();
  await upsertCoupons();
  await upsertCombo();
  await upsertE2eOrder();
  const [cats, prods, vars, coups, zones, orders] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.coupon.count(),
    prisma.shippingZone.count(),
    prisma.order.count(),
  ]);
  console.log(`✅ Seed listo: ${cats} categorías, ${prods} productos, ${vars} variantes, ${coups} cupones, ${zones} zonas, ${orders} pedidos.`);
}

main()
  .catch((e) => {
    console.error("❌ Seed falló:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
