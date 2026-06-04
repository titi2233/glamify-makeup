import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateSku } from "../src/lib/sku";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ---- Catálogo de prueba (dev/preview). "No humo": stock y ofertas con datos reales. ----

interface SeedCategory {
  slug: string;
  name: string;
  skuPrefix: string;
  order: number;
  children?: SeedCategory[];
}

const CATEGORIES: SeedCategory[] = [
  {
    slug: "labios", name: "Labios", skuPrefix: "LAB", order: 0,
    children: [
      { slug: "labiales", name: "Labiales", skuPrefix: "LAB", order: 0 },
      { slug: "gloss", name: "Gloss", skuPrefix: "GLO", order: 1 },
    ],
  },
  {
    slug: "ojos", name: "Ojos", skuPrefix: "OJO", order: 1,
    children: [
      { slug: "mascaras", name: "Máscaras de pestañas", skuPrefix: "MAS", order: 0 },
      { slug: "sombras", name: "Sombras", skuPrefix: "SOM", order: 1 },
    ],
  },
  {
    slug: "rostro", name: "Rostro", skuPrefix: "ROS", order: 2,
    children: [
      { slug: "rubores", name: "Rubores", skuPrefix: "RUB", order: 0 },
      { slug: "bases", name: "Bases", skuPrefix: "BAS", order: 1 },
    ],
  },
  {
    slug: "accesorios", name: "Accesorios", skuPrefix: "ACC", order: 3,
    children: [{ slug: "brochas", name: "Brochas y esponjas", skuPrefix: "BRO", order: 0 }],
  },
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
  variants: SeedVariant[];
}

const PRODUCTS: SeedProduct[] = [
  {
    slug: "labial-mate-larga-duracion", name: "Labial Mate Larga Duración", categorySlug: "labiales",
    description: "Color intenso que dura todo el día, acabado mate aterciopelado y cómodo.",
    basePrice: 3200, compareAtPrice: 3990, cost: 1400, weightGr: 25, isFeatured: true, heroRank: 1, tags: ["mate", "larga duración"],
    variants: [
      { name: "Rojo Pasión", swatchHex: "#C0392B", stock: 18 },
      { name: "Fucsia Glam", swatchHex: "#FF2E93", stock: 9 },
      { name: "Nude Rosado", swatchHex: "#C8A27C", stock: 2, lowStockThreshold: 3 },
      { name: "Vino", swatchHex: "#6E0B3F", stock: 0 },
    ],
  },
  {
    slug: "gloss-brillo-humedo", name: "Gloss Brillo Húmedo", categorySlug: "gloss",
    description: "Brillo espejo no pegajoso con un toque de color. Efecto labios jugosos.",
    basePrice: 2500, cost: 1000, weightGr: 22, isFeatured: true, heroRank: 2, tags: ["brillo"],
    variants: [
      { name: "Transparente", swatchHex: "#F4E7EE", stock: 25 },
      { name: "Rosa Bebé", swatchHex: "#FF9ED1", stock: 14 },
      { name: "Coral", swatchHex: "#FF7F6E", stock: 6 },
    ],
  },
  {
    slug: "mascara-volumen-extremo", name: "Máscara de Pestañas Volumen Extremo", categorySlug: "mascaras",
    description: "Pestañas con volumen dramático sin grumos. Cepillo de fibras finas.",
    basePrice: 4100, cost: 1800, weightGr: 30, isFeatured: true, heroRank: 3, tags: ["volumen"],
    variants: [
      { name: "Negro Intenso", swatchHex: "#111111", stock: 20 },
      { name: "Marrón", swatchHex: "#5B3A29", stock: 3, lowStockThreshold: 3 },
    ],
  },
  {
    slug: "paleta-sombras-glam-12", name: "Paleta de Sombras Glam 12 Tonos", categorySlug: "sombras",
    description: "12 tonos mate y shimmer altamente pigmentados para looks de día y noche.",
    basePrice: 6900, compareAtPrice: 8500, cost: 3000, weightGr: 120, isFeatured: true, heroRank: 4, tags: ["paleta", "shimmer"],
    variants: [{ name: "Único", swatchHex: "#C8A27C", stock: 11 }],
  },
  {
    slug: "rubor-compacto-sedoso", name: "Rubor Compacto Sedoso", categorySlug: "rubores",
    description: "Color natural y difuminable, acabado satinado que ilumina el rostro.",
    basePrice: 2990, cost: 1200, weightGr: 28, tags: ["rubor"],
    variants: [
      { name: "Durazno", swatchHex: "#F4A07A", stock: 16 },
      { name: "Rosa Suave", swatchHex: "#FF9ED1", stock: 8 },
      { name: "Coral Cálido", swatchHex: "#FF7F6E", stock: 1, lowStockThreshold: 3 },
    ],
  },
  {
    slug: "base-fluida-hd", name: "Base Fluida HD", categorySlug: "bases",
    description: "Cobertura media a alta, acabado natural HD de larga duración.",
    basePrice: 5500, cost: 2400, weightGr: 60, tags: ["base", "hd"],
    variants: [
      { name: "Tono 01 Claro", swatchHex: "#F2D6C2", stock: 12 },
      { name: "Tono 02 Natural", swatchHex: "#E3B89A", stock: 12 },
      { name: "Tono 03 Medio", swatchHex: "#C99572", stock: 7 },
      { name: "Tono 04 Tostado", swatchHex: "#A66B47", stock: 4 },
    ],
  },
  {
    slug: "set-brochas-x5", name: "Set de Brochas Profesionales x5", categorySlug: "brochas",
    description: "5 brochas esenciales de cerda suave para rostro y ojos. Incluye estuche.",
    basePrice: 7800, compareAtPrice: 9900, cost: 3500, weightGr: 200, tags: ["set", "brochas"],
    variants: [{ name: "Rosa", swatchHex: "#FF2E93", stock: 5 }],
  },
  {
    slug: "delineador-liquido-precision", name: "Delineador Líquido Precisión", categorySlug: "mascaras",
    description: "Punta ultrafina para un trazo preciso. Negro intenso a prueba de smudge.",
    basePrice: 3300, cost: 1300, weightGr: 18, tags: ["delineador"],
    variants: [{ name: "Negro", swatchHex: "#111111", stock: 22 }],
  },
  {
    slug: "iluminador-liquido-glow", name: "Iluminador Líquido Glow", categorySlug: "rubores",
    description: "Glow húmedo de acabado dorado-rosado. Solo o mezclado con la base.",
    basePrice: 4200, cost: 1700, weightGr: 35, tags: ["glow", "iluminador"],
    variants: [
      { name: "Champagne", swatchHex: "#EAD3A2", stock: 10 },
      { name: "Oro Rosa", swatchHex: "#E6B7A9", stock: 0 },
    ],
  },
  {
    slug: "labial-cremoso-nude", name: "Labial Cremoso Nude", categorySlug: "labiales",
    description: "Textura cremosa hidratante con tonos nude versátiles para todos los días.",
    basePrice: 3000, cost: 1250, weightGr: 24, tags: ["cremoso", "nude"],
    variants: [
      { name: "Nude Cálido", swatchHex: "#C8927A", stock: 13 },
      { name: "Rosa Maquillaje", swatchHex: "#D98E9E", stock: 9 },
      { name: "Caramelo", swatchHex: "#B97A52", stock: 2, lowStockThreshold: 3 },
    ],
  },
  {
    slug: "esponja-maquillaje-blender", name: "Esponja de Maquillaje Blender", categorySlug: "brochas",
    description: "Esponja sin látex que difumina la base para un acabado impecable.",
    basePrice: 1800, cost: 600, weightGr: 12, tags: ["esponja"],
    variants: [
      { name: "Rosa", swatchHex: "#FF9ED1", stock: 30 },
      { name: "Violeta", swatchHex: "#8B5CF6", stock: 17 },
    ],
  },
  {
    slug: "primer-facial-poro-cero", name: "Primer Facial Poro Cero", categorySlug: "bases",
    description: "Prebase matificante que difumina poros y prolonga la duración del maquillaje.",
    basePrice: 4800, cost: 2000, weightGr: 40, tags: ["primer"],
    variants: [{ name: "Único", swatchHex: "#F4E7EE", stock: 6 }],
  },
];

async function upsertCategories(): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();
  for (const parent of CATEGORIES) {
    const p = await prisma.category.upsert({
      where: { slug: parent.slug },
      update: { name: parent.name, skuPrefix: parent.skuPrefix, order: parent.order, parentId: null, active: true },
      create: { slug: parent.slug, name: parent.name, skuPrefix: parent.skuPrefix, order: parent.order },
    });
    idBySlug.set(parent.slug, p.id);
  }
  for (const parent of CATEGORIES) {
    for (const child of parent.children ?? []) {
      const c = await prisma.category.upsert({
        where: { slug: child.slug },
        update: { name: child.name, skuPrefix: child.skuPrefix, order: child.order, parentId: idBySlug.get(parent.slug)!, active: true },
        create: { slug: child.slug, name: child.name, skuPrefix: child.skuPrefix, order: child.order, parentId: idBySlug.get(parent.slug)! },
      });
      idBySlug.set(child.slug, c.id);
    }
  }
  return idBySlug;
}

function prefixForSlug(slug: string): string {
  for (const parent of CATEGORIES) {
    if (parent.slug === slug) return parent.skuPrefix;
    for (const child of parent.children ?? []) if (child.slug === slug) return child.skuPrefix;
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
      },
      create: {
        slug: p.slug, name: p.name, description: p.description, categoryId,
        basePrice: p.basePrice, compareAtPrice: p.compareAtPrice ?? null, cost: p.cost, weightGr: p.weightGr,
        isFeatured: p.isFeatured ?? false, heroRank: p.heroRank ?? null, tags: p.tags ?? [], images: [],
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

async function main(): Promise<void> {
  console.log("🌱 Seeding catálogo Glamify Makeup…");
  const idBySlug = await upsertCategories();
  await upsertProducts(idBySlug);
  const [cats, prods, vars] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.productVariant.count(),
  ]);
  console.log(`✅ Seed listo: ${cats} categorías, ${prods} productos, ${vars} variantes.`);
}

main()
  .catch((e) => {
    console.error("❌ Seed falló:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
