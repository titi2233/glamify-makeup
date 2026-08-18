import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "fs";
import path from "path";
import { generateSku } from "../src/lib/sku";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

interface CategoryDef {
  slug: string;
  name: string;
  skuPrefix: string;
  order: number;
  image?: string;
  children?: Array<{
    slug: string;
    name: string;
    skuPrefix: string;
    order: number;
  }>;
}

const CATEGORIES_DEF: CategoryDef[] = [
  {
    slug: "labios",
    name: "Labios",
    skuPrefix: "LAB",
    order: 0,
    image: "/images/category_labios.png",
    children: [
      { slug: "labiales", name: "Labiales", skuPrefix: "LAB", order: 0 },
      { slug: "gloss", name: "Gloss y Brillos", skuPrefix: "GLO", order: 1 },
      { slug: "delineadores-labios", name: "Delineadores de Labios", skuPrefix: "DLL", order: 2 },
    ],
  },
  {
    slug: "ojos",
    name: "Ojos",
    skuPrefix: "OJO",
    order: 1,
    image: "/images/category_ojos.png",
    children: [
      { slug: "mascaras", name: "Máscaras de Pestañas", skuPrefix: "MAS", order: 0 },
      { slug: "delineadores", name: "Delineadores de Ojos", skuPrefix: "DEL", order: 1 },
      { slug: "sombras", name: "Sombras", skuPrefix: "SOM", order: 2 },
      { slug: "cejas", name: "Cejas y Pestañas", skuPrefix: "CEJ", order: 3 },
    ],
  },
  {
    slug: "rostro",
    name: "Rostro",
    skuPrefix: "ROS",
    order: 2,
    image: "/images/category_rostro.png",
    children: [
      { slug: "rubores", name: "Rubores", skuPrefix: "RUB", order: 0 },
      { slug: "iluminadores", name: "Iluminadores y Contornos", skuPrefix: "ILU", order: 1 },
      { slug: "bases", name: "Bases", skuPrefix: "BAS", order: 2 },
      { slug: "correctores", name: "Correctores", skuPrefix: "COR", order: 3 },
      { slug: "polvos", name: "Polvos Compactos", skuPrefix: "POL", order: 4 },
    ],
  },
  {
    slug: "accesorios",
    name: "Accesorios",
    skuPrefix: "ACC",
    order: 3,
    image: "/images/category_accesorios.png",
    children: [
      { slug: "brochas", name: "Brochas y Esponjas", skuPrefix: "BRO", order: 0 },
      { slug: "arqueadores", name: "Arqueadores y Herramientas", skuPrefix: "ARQ", order: 1 },
    ],
  },
];

interface CatalogItem {
  name: string;
  brand: string;
  subCategorySlug: string;
  description: string;
  cost: number;
  salePrice: number;
  weightGr: number;
  tags: string[];
  variants: Array<{
    name: string;
    stock: number;
    swatchHex?: string;
  }>;
}

const CATALOG_DATA: CatalogItem[] = [
  {
    name: "Delineador de Labios Karité",
    brand: "Karité",
    subCategorySlug: "delineadores-labios",
    description: "Delineador de labios de alta precisión y textura cremosa para perfilar, definir y realzar el contorno con acabado uniforme.",
    cost: 600,
    salePrice: 2000,
    weightGr: 15,
    tags: ["Karité", "Labios", "Delineador", "Cremoso"],
    variants: [
      { name: "Tono 1", stock: 10 },
      { name: "Tono 2", stock: 10 },
      { name: "Tono 3", stock: 10 },
      { name: "Tono 4", stock: 10 },
      { name: "Tono 5", stock: 10 },
      { name: "Tono 6", stock: 10 },
      { name: "Tono 7", stock: 10 },
      { name: "Tono 8", stock: 10 },
    ],
  },
  {
    name: "Delineador de Labios 4 Angels",
    brand: "4 Angels",
    subCategorySlug: "delineadores-labios",
    description: "Delineador para labios de trazo suave y duradero, ideal para combinar con tus labiales y evitar que el color se desplace.",
    cost: 500,
    salePrice: 2000,
    weightGr: 15,
    tags: ["4 Angels", "Labios", "Delineador"],
    variants: [
      { name: "Tono 1", stock: 10 },
      { name: "Tono 2", stock: 10 },
      { name: "Tono 3", stock: 10 },
      { name: "Tono 4", stock: 10 },
      { name: "Tono 5", stock: 10 },
      { name: "Tono 6", stock: 10 },
      { name: "Tono 7", stock: 10 },
      { name: "Tono 8", stock: 10 },
    ],
  },
  {
    name: "Lip Balm Color Change TEI",
    brand: "TEI",
    subCategorySlug: "gloss",
    description: "Bálsamo ultra hidratante que reacciona de forma mágica al pH de tus labios creando un tono rosado personalizado y natural.",
    cost: 1350,
    salePrice: 3000,
    weightGr: 20,
    tags: ["TEI", "Labios", "Bálsamo", "Color Change", "Hidratante"],
    variants: [{ name: "Único", stock: 10 }],
  },
  {
    name: "Lifter Glaze TEI",
    brand: "TEI",
    subCategorySlug: "gloss",
    description: "Gloss labial efecto glaseado de máximo brillo, fórmula no pegajosa que aporta luminosidad y frescura al instante.",
    cost: 1800,
    salePrice: 4000,
    weightGr: 25,
    tags: ["TEI", "Gloss", "Glaze", "Brillo"],
    variants: [
      { name: "Tono 1", stock: 10 },
      { name: "Tono 2", stock: 10 },
      { name: "Tono 3", stock: 10 },
      { name: "Tono 4", stock: 10 },
      { name: "Tono 5", stock: 10 },
      { name: "Tono 6", stock: 10 },
    ],
  },
  {
    name: "Lifter Gloss TEI",
    brand: "TEI",
    subCategorySlug: "gloss",
    description: "Brillo labial hidratante que aporta sensación de volumen y plenitud con un acabado brillante espejo deslumbrante.",
    cost: 2000,
    salePrice: 4500,
    weightGr: 25,
    tags: ["TEI", "Gloss", "Lifter", "Volumen"],
    variants: [
      { name: "Tono 1", stock: 10 },
      { name: "Tono 2", stock: 10 },
      { name: "Tono 3", stock: 10 },
      { name: "Tono 4", stock: 10 },
      { name: "Tono 5", stock: 10 },
      { name: "Tono 6", stock: 10 },
    ],
  },
  {
    name: "Vinyl Ink Matte Líquido TEI",
    brand: "TEI",
    subCategorySlug: "labiales",
    description: "Labial líquido de alta pigmentación con acabado matte sedoso, fórmula resistente que no se corre ni cuartea.",
    cost: 1800,
    salePrice: 4000,
    weightGr: 25,
    tags: ["TEI", "Labial Líquido", "Vinyl Ink", "Matte"],
    variants: [
      { name: "Tono 1", stock: 10 },
      { name: "Tono 2", stock: 10 },
      { name: "Tono 3", stock: 10 },
      { name: "Tono 4", stock: 10 },
      { name: "Tono 5", stock: 10 },
      { name: "Tono 6", stock: 10 },
    ],
  },
  {
    name: "SuperStay Matte Líquido TEI",
    brand: "TEI",
    subCategorySlug: "labiales",
    description: "Labial líquido mate intransferible de larga duración. Color intenso de una sola pasada y sensación súper liviana.",
    cost: 1950,
    salePrice: 4000,
    weightGr: 25,
    tags: ["TEI", "Labial Líquido", "SuperStay", "Larga Duración"],
    variants: [
      { name: "Tono 1", stock: 10 },
      { name: "Tono 2", stock: 10 },
      { name: "Tono 3", stock: 10 },
      { name: "Tono 4", stock: 10 },
      { name: "Tono 5", stock: 10 },
      { name: "Tono 6", stock: 10 },
    ],
  },
  {
    name: "Lip Stack 4 en 1 TEI",
    brand: "TEI",
    subCategorySlug: "labiales",
    description: "Práctica torre apilable con 4 tonos de labiales cremosos en un solo envase. Compacto, versátil e ideal para cartera.",
    cost: 1600,
    salePrice: 3500,
    weightGr: 35,
    tags: ["TEI", "Lip Stack", "4 en 1", "Portátil"],
    variants: [
      { name: "Variante 1", stock: 10 },
      { name: "Variante 2", stock: 10 },
      { name: "Variante 3", stock: 10 },
    ],
  },
  {
    name: "Máscara de Pestañas 'Sky High' TEI",
    brand: "TEI",
    subCategorySlug: "mascaras",
    description: "Máscara alargadora con cepillo flexible que atrapa y extiende cada pestaña desde la raíz hasta la punta sin dejar grumos.",
    cost: 1750,
    salePrice: 4000,
    weightGr: 30,
    tags: ["TEI", "Máscara", "Pestañas", "Sky High", "Alargadora"],
    variants: [
      { name: "Rosa", stock: 10 },
      { name: "Negra", stock: 10 },
    ],
  },
  {
    name: "Repuestos para Arqueador de Pestañas",
    brand: "",
    subCategorySlug: "arqueadores",
    description: "Pack de gomitas de repuesto de silicona flexible para arqueadores de pestañas. Aseguran una curvatura uniforme y cuidan tus pestañas.",
    cost: 300,
    salePrice: 1000,
    weightGr: 10,
    tags: ["Accesorios", "Pestañas", "Arqueador", "Repuestos"],
    variants: [{ name: "Único", stock: 15 }],
  },
  {
    name: "Arqueador de Pestañas con Brillos",
    brand: "",
    subCategorySlug: "arqueadores",
    description: "Arqueador ergonómico con detalles en glitter. Diseñado para curvar las pestañas suavemente con máxima precisión y apertura.",
    cost: 1500,
    salePrice: 3500,
    weightGr: 40,
    tags: ["Accesorios", "Arqueador", "Glitter", "Pestañas"],
    variants: [
      { name: "Rosa Brillos", stock: 10 },
      { name: "Violeta Brillos", stock: 10 },
      { name: "Rosa Oscuro", stock: 10 },
    ],
  },
  {
    name: "Delineador Líquido Ruby Rose",
    brand: "Ruby Rose",
    subCategorySlug: "delineadores",
    description: "Delineador de ojos líquido negro intenso. Su punta de precisión permite realizar desde trazos finos y sutiles hasta delineados cat-eye definidos.",
    cost: 1800,
    salePrice: 4000,
    weightGr: 20,
    tags: ["Ruby Rose", "Delineador Líquido", "Ojos", "Negro Intenso"],
    variants: [{ name: "Negro", stock: 12 }],
  },
  {
    name: "Delineador de Ojos Retráctil",
    brand: "",
    subCategorySlug: "delineadores",
    description: "Lápiz delineador retráctil suave y pigmentado. No necesita sacapuntas, perfecto para la línea de agua o párpados.",
    cost: 210,
    salePrice: 1500,
    weightGr: 15,
    tags: ["Delineador", "Retráctil", "Ojos"],
    variants: [{ name: "Negro", stock: 15 }],
  },
  {
    name: "Iluminador & Contorno en Barra TEI",
    brand: "TEI",
    subCategorySlug: "iluminadores",
    description: "Stick multiuso dúo para iluminar y contornear el rostro. Textura cremosa ultra difuminable para esculpir las facciones.",
    cost: 1400,
    salePrice: 3500,
    weightGr: 35,
    tags: ["TEI", "Contorno", "Iluminador", "En Barra", "Stick"],
    variants: [
      { name: "Tono 1", stock: 10 },
      { name: "Tono 2", stock: 10 },
      { name: "Tono 3", stock: 10 },
    ],
  },
  {
    name: "Rubor en Barra Cuadrado TEI",
    brand: "TEI",
    subCategorySlug: "rubores",
    description: "Rubor cremoso en barra cuadrada. Se desliza suavemente sobre la piel aportando un toque de color saludable, fresco y natural.",
    cost: 1700,
    salePrice: 3500,
    weightGr: 30,
    tags: ["TEI", "Rubor", "En Barra", "Cremoso"],
    variants: [
      { name: "Tono 1", stock: 10 },
      { name: "Tono 2", stock: 10 },
      { name: "Tono 3", stock: 10 },
      { name: "Tono 4", stock: 10 },
      { name: "Tono 5", stock: 10 },
      { name: "Tono 6", stock: 10 },
    ],
  },
  {
    name: "Rubor en Crema Corazón PINK 21",
    brand: "PINK 21",
    subCategorySlug: "rubores",
    description: "Hermoso rubor en crema con diseño en relieve de corazón. Alta pigmentación modulable que deja las mejillas radiantes y aterciopeladas.",
    cost: 2300,
    salePrice: 4800,
    weightGr: 30,
    tags: ["PINK 21", "Rubor en Crema", "Corazón", "Rostro"],
    variants: [
      { name: "Tono 1", stock: 10 },
      { name: "Tono 2", stock: 10 },
      { name: "Tono 3", stock: 10 },
      { name: "Tono 4", stock: 10 },
    ],
  },
  {
    name: "Polvo Compacto 2 en 1 Rimera Quince",
    brand: "Rimera Quince",
    subCategorySlug: "polvos",
    description: "Polvo compacto matificante doble acción. Sella el maquillaje, controla el brillo durante todo el día y unifica el tono.",
    cost: 2350,
    salePrice: 5000,
    weightGr: 50,
    tags: ["Rimera Quince", "Polvo Compacto", "2 en 1", "Matificante"],
    variants: [
      { name: "Tono 1", stock: 10 },
      { name: "Tono 2", stock: 10 },
    ],
  },
  {
    name: "Lip Balm Frutilla Llavero TEI",
    brand: "TEI",
    subCategorySlug: "gloss",
    description: "Bálsamo labial hidratante con exquisito aroma a frutilla en un tierno formato llavero para llevar en tu mochila o cartera.",
    cost: 1200,
    salePrice: 2500,
    weightGr: 25,
    tags: ["TEI", "Lip Balm", "Frutilla", "Llavero", "Hidratante"],
    variants: [
      { name: "Roja", stock: 10 },
      { name: "Rosa", stock: 10 },
    ],
  },
  {
    name: "Máscara 'So Big Lashes' PINK 21",
    brand: "PINK 21",
    subCategorySlug: "mascaras",
    description: "Máscara de pestañas con cepillo de cerdas densas para un volumen dramático, espesor y curvatura duradera.",
    cost: 1400,
    salePrice: 3000,
    weightGr: 30,
    tags: ["PINK 21", "Máscara", "So Big Lashes", "Volumen"],
    variants: [{ name: "Negro Intenso", stock: 12 }],
  },
  {
    name: "Iluminador & Contorno en Polvo TEI",
    brand: "TEI",
    subCategorySlug: "iluminadores",
    description: "Dúo compacto de iluminador y tonalizador en polvo fino. Ideal para marcar pómulos, perfilar la nariz y dar luz al rostro.",
    cost: 1850,
    salePrice: 3500,
    weightGr: 45,
    tags: ["TEI", "Iluminador", "Contorno", "En Polvo", "Dúo"],
    variants: [
      { name: "Tono 1", stock: 10 },
      { name: "Tono 2", stock: 10 },
      { name: "Tono 3", stock: 10 },
    ],
  },
  {
    name: "Lip Oil Nutritivo PINK 21",
    brand: "PINK 21",
    subCategorySlug: "gloss",
    description: "Aceite labial nutritivo enriquecido con aceites humectantes. Deja los labios suaves, jugosos y con un brillo saludable no pegajoso.",
    cost: 1450,
    salePrice: 3000,
    weightGr: 25,
    tags: ["PINK 21", "Lip Oil", "Nutritivo", "Brillo"],
    variants: [
      { name: "Tono 1", stock: 10 },
      { name: "Tono 2", stock: 10 },
      { name: "Tono 3", stock: 10 },
      { name: "Tono 4", stock: 10 },
    ],
  },
  {
    name: "Máscara 'Super Volume 2in1' PINK 21",
    brand: "PINK 21",
    subCategorySlug: "mascaras",
    description: "Máscara con tecnología doble cepillo: paso 1 para alargar y definir, paso 2 para multiplicar el volumen y cuerpo.",
    cost: 1900,
    salePrice: 4000,
    weightGr: 35,
    tags: ["PINK 21", "Máscara", "Super Volume", "2 en 1"],
    variants: [{ name: "Negro", stock: 12 }],
  },
  {
    name: "Iluminador Líquido Multiuso PINK 21",
    brand: "PINK 21",
    subCategorySlug: "iluminadores",
    description: "Gotas iluminadoras concentradas con microperlas reflejantes de luz. Se puede aplicar directo o mezclar con la base para un glow radiante.",
    cost: 1400,
    salePrice: 3500,
    weightGr: 35,
    tags: ["PINK 21", "Iluminador Líquido", "Glow", "Multiuso"],
    variants: [
      { name: "Tono 1", stock: 10 },
      { name: "Tono 2", stock: 10 },
      { name: "Tono 3", stock: 10 },
      { name: "Tono 4", stock: 10 },
      { name: "Tono 5", stock: 10 },
      { name: "Tono 6", stock: 10 },
    ],
  },
  {
    name: "Base de Maquillaje Líquida 4 Angels",
    brand: "4 Angels",
    subCategorySlug: "bases",
    description: "Base fluida de acabado uniforme y cobertura construible. Unifica la piel dejando un acabado aterciopelado de larga permanencia.",
    cost: 1350,
    salePrice: 3500,
    weightGr: 60,
    tags: ["4 Angels", "Base Líquida", "Rostro", "Cobertura"],
    variants: [
      { name: "Tono 1", stock: 10 },
      { name: "Tono 2", stock: 10 },
      { name: "Tono 3", stock: 10 },
      { name: "Tono 4", stock: 10 },
      { name: "Tono 5", stock: 10 },
      { name: "Tono 6", stock: 10 },
    ],
  },
  {
    name: "Lip Oil Hidratante TEI",
    brand: "TEI",
    subCategorySlug: "gloss",
    description: "Aceite labial regenerador que nutre y aporta brillo cristalino a los labios. Sensación súper confortable y liviana.",
    cost: 1400,
    salePrice: 3000,
    weightGr: 25,
    tags: ["TEI", "Lip Oil", "Hidratante", "Brillo"],
    variants: [{ name: "Único", stock: 10 }],
  },
  {
    name: "Brillo Labial de Sabores Roll On 4 Angels",
    brand: "4 Angels",
    subCategorySlug: "gloss",
    description: "Brillo labial transparente con roll-on aplicador de bolilla metálica. Deliciosos aromas frutales que hidratan y aportan brillo.",
    cost: 750,
    salePrice: 2500,
    weightGr: 25,
    tags: ["4 Angels", "Roll On", "Brillo Labial", "Sabores"],
    variants: [
      { name: "Tono 1", stock: 10 },
      { name: "Tono 2", stock: 10 },
      { name: "Tono 3", stock: 10 },
      { name: "Tono 5", stock: 10 },
      { name: "Tono 6", stock: 10 },
    ],
  },
  {
    name: "Gel Fijador Cejas y Pestañas MELY",
    brand: "MELY",
    subCategorySlug: "cejas",
    description: "Gel transparente fijador de secado rápido. Peina, peina y lamina cejas y pestañas manteniéndolas en su lugar todo el día sin rigidez.",
    cost: 1600,
    salePrice: 3500,
    weightGr: 25,
    tags: ["MELY", "Gel Fijador", "Cejas", "Pestañas", "Laminado"],
    variants: [{ name: "Transparente", stock: 12 }],
  },
  {
    name: "Corrector Líquido Multiuso 4 Angels",
    brand: "4 Angels",
    subCategorySlug: "correctores",
    description: "Corrector líquido de alta cobertura y acabado natural. Cubre ojeras, manchas e imperfecciones con aplicador de esponja suave.",
    cost: 1400,
    salePrice: 3500,
    weightGr: 30,
    tags: ["4 Angels", "Corrector Líquido", "Ojeras", "Alta Cobertura"],
    variants: [
      { name: "Tono 1", stock: 10 },
      { name: "Tono 2", stock: 10 },
      { name: "Tono 3", stock: 10 },
      { name: "Tono 4", stock: 10 },
      { name: "Tono 5", stock: 10 },
      { name: "Tono 6", stock: 10 },
    ],
  },
  {
    name: "Rubor Líquido Pink Touch PINK 21",
    brand: "PINK 21",
    subCategorySlug: "rubores",
    description: "Rubor líquido altamente pigmentado con aplicador cushion. Se funde perfectamente con la piel dejando un efecto sonrojado fresco y duradero.",
    cost: 1200,
    salePrice: 2500,
    weightGr: 25,
    tags: ["PINK 21", "Rubor Líquido", "Pink Touch", "Mejillas"],
    variants: [
      { name: "Tono 1", stock: 10 },
      { name: "Tono 2", stock: 10 },
      { name: "Tono 3", stock: 10 },
      { name: "Tono 4", stock: 10 },
      { name: "Tono 5", stock: 10 },
      { name: "Tono 6", stock: 10 },
    ],
  },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  console.log("==================================================");
  console.log("   INICIANDO IMPORTACIÓN DEL CATÁLOGO GLAMIFY     ");
  console.log("==================================================\n");

  // 1. Sincronizar categorías
  console.log("1. Creando / verificando categorías...");
  const categoryMap = new Map<string, { id: string; skuPrefix: string }>();

  for (const catDef of CATEGORIES_DEF) {
    let parent = await prisma.category.findUnique({ where: { slug: catDef.slug } });
    if (!parent) {
      parent = await prisma.category.create({
        data: {
          slug: catDef.slug,
          name: catDef.name,
          skuPrefix: catDef.skuPrefix,
          order: catDef.order,
          image: catDef.image,
          active: true,
        },
      });
      console.log(`  [+] Categoría principal creada: ${parent.name} (${parent.slug})`);
    } else {
      categoryMap.set(parent.slug, { id: parent.id, skuPrefix: parent.skuPrefix });
    }

    if (catDef.children) {
      for (const childDef of catDef.children) {
        let child = await prisma.category.findUnique({ where: { slug: childDef.slug } });
        if (!child) {
          child = await prisma.category.create({
            data: {
              slug: childDef.slug,
              name: childDef.name,
              skuPrefix: childDef.skuPrefix,
              order: childDef.order,
              parentId: parent.id,
              active: true,
            },
          });
          console.log(`      [+] Subcategoría creada: ${child.name} (${child.slug}) [${child.skuPrefix}]`);
        }
        categoryMap.set(child.slug, { id: child.id, skuPrefix: child.skuPrefix });
      }
    }
  }

  // 2. Limpiar productos de prueba iniciales (si existen y se desea catálogo limpio)
  const testProducts = await prisma.product.findMany({
    where: {
      OR: [
        { slug: "producto-prueba" },
        { slug: "labial-pink-21" },
        { name: "Producto prueba" },
      ],
    },
  });
  if (testProducts.length > 0) {
    console.log(`\n2. Limpiando ${testProducts.length} productos dummy de prueba...`);
    for (const tp of testProducts) {
      await prisma.productVariant.deleteMany({ where: { productId: tp.id } });
      await prisma.product.delete({ where: { id: tp.id } });
      console.log(`  [-] Eliminado dummy: ${tp.name}`);
    }
  }

  // 3. Crear o actualizar productos del catálogo
  console.log(`\n3. Insertando ${CATALOG_DATA.length} productos del catálogo...`);
  let createdCount = 0;
  let updatedCount = 0;
  let variantCount = 0;

  // Secuencia de SKUs por prefijo
  const skuCounters = new Map<string, number>();

  // Cargar secuencias existentes de SKUs
  const existingVariants = await prisma.productVariant.findMany({
    select: { sku: true },
  });
  for (const v of existingVariants) {
    const match = v.sku.match(/^([A-Z]{1,3})-(\d+)$/);
    if (match) {
      const pfx = match[1];
      const seq = parseInt(match[2], 10);
      const curr = skuCounters.get(pfx) || 0;
      if (seq > curr) skuCounters.set(pfx, seq);
    }
  }

  function getNextSku(prefix: string): string {
    const nextSeq = (skuCounters.get(prefix) || 0) + 1;
    skuCounters.set(prefix, nextSeq);
    return generateSku(prefix, nextSeq);
  }

  for (let i = 0; i < CATALOG_DATA.length; i++) {
    const item = CATALOG_DATA[i];
    const catInfo = categoryMap.get(item.subCategorySlug);
    if (!catInfo) {
      throw new Error(`Categoría no encontrada para slug: ${item.subCategorySlug}`);
    }

    const slug = slugify(item.name);
    const existing = await prisma.product.findFirst({
      where: { slug },
      include: { variants: true },
    });

    if (existing) {
      // Actualizar producto
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: item.name,
          description: item.description,
          categoryId: catInfo.id,
          basePrice: item.salePrice,
          cost: item.cost,
          weightGr: item.weightGr,
          tags: item.tags,
          active: true,
        },
      });
      updatedCount++;
      console.log(`  [~] Actualizado: ${item.name} (${slug})`);
    } else {
      // Crear producto con variantes y SKUs
      const variantsData = item.variants.map((v, vIdx) => ({
        name: v.name,
        sku: getNextSku(catInfo.skuPrefix),
        stock: v.stock,
        lowStockThreshold: 3,
        active: true,
        order: vIdx,
        swatchHex: v.swatchHex ?? null,
      }));

      await prisma.product.create({
        data: {
          slug,
          name: item.name,
          description: item.description,
          categoryId: catInfo.id,
          basePrice: item.salePrice,
          cost: item.cost,
          weightGr: item.weightGr,
          tags: item.tags,
          images: [],
          active: true,
          variants: {
            create: variantsData,
          },
        },
      });

      createdCount++;
      variantCount += variantsData.length;
      console.log(
        `  [+] Creado (${(i + 1).toString().padStart(2, " ")}/${CATALOG_DATA.length}): ${item.name} | $${item.salePrice.toLocaleString("es-AR")} | ${variantsData.length} tonos | SKU ${variantsData[0].sku}`
      );
    }
  }

  console.log("\n==================================================");
  console.log("   ¡IMPORTACIÓN COMPLETADA CON ÉXITO!            ");
  console.log(`   - Productos nuevos creados: ${createdCount}`);
  console.log(`   - Productos actualizados: ${updatedCount}`);
  console.log(`   - Variantes/tonos generados: ${variantCount}`);
  console.log("==================================================");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error durante la importación:", e);
  process.exit(1);
});
