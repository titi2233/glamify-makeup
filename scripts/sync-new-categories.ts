import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const NEW_CATEGORIES = [
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

async function main() {
  console.log("=== SINCRONIZANDO NUEVAS CATEGORÍAS ===");

  const catMap = new Map<string, string>();

  // 1. Upsert las 9 nuevas categorías
  for (const cat of NEW_CATEGORIES) {
    const upserted = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        skuPrefix: cat.skuPrefix,
        order: cat.order,
        image: cat.image,
        active: true,
        parentId: null,
      },
      create: {
        slug: cat.slug,
        name: cat.name,
        skuPrefix: cat.skuPrefix,
        order: cat.order,
        image: cat.image,
        active: true,
      },
    });
    catMap.set(cat.slug, upserted.id);
    console.log(`[+] Categoría configurada: ${cat.name} (${cat.slug}) -> ${cat.image}`);
  }

  // 2. Mapeo de categorías anteriores para migrar productos huérfanos si existen
  const migrations: Record<string, string> = {
    labiales: "labios",
    gloss: "labios",
    mascaras: "pestanas",
    sombras: "otros",
    rubores: "rubor",
    bases: "bases-y-correctores",
    brochas: "brochas-y-esponjas",
    accesorios: "brochas-y-esponjas",
    ojos: "pestanas",
    rostro: "bases-y-correctores",
  };

  for (const [oldSlug, newSlug] of Object.entries(migrations)) {
    const oldCat = await prisma.category.findUnique({ where: { slug: oldSlug } });
    const newCatId = catMap.get(newSlug);
    if (oldCat && newCatId) {
      const updatedProds = await prisma.product.updateMany({
        where: { categoryId: oldCat.id },
        data: { categoryId: newCatId },
      });
      if (updatedProds.count > 0) {
        console.log(`[+] Migrados ${updatedProds.count} productos de '${oldSlug}' a '${newSlug}'`);
      }
    }
  }

  console.log("=== SINCRONIZACIÓN DE CATEGORÍAS FINALIZADA EXITOSAMENTE ===");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
