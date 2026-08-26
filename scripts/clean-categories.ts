import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== LIMPIEZA DE CATEGORÍAS OBSOLETAS ===");

  // 1. Obtener todas las categorías
  const allCats = await prisma.category.findMany();
  const catBySlug = new Map(allCats.map((c) => [c.slug, c]));

  // Mapa de migración hacia categorías principales limpias
  const migrations: Record<string, string> = {
    ojos: "pestanas",
    rostro: "bases-y-correctores",
    accesorios: "brochas-y-esponjas",
    mascaras: "pestanas",
    sombras: "otros",
    delineadores: "delineador",
    cejas: "pestanas",
    rubores: "rubor",
    bases: "bases-y-correctores",
    iluminadores: "iluminador",
    correctores: "bases-y-correctores",
    polvos: "bases-y-correctores",
    brochas: "brochas-y-esponjas",
    arqueadores: "brochas-y-esponjas",
    labiales: "labios",
    gloss: "labios",
    "delineadores-labios": "labios",
  };

  for (const [oldSlug, targetSlug] of Object.entries(migrations)) {
    const oldCat = catBySlug.get(oldSlug);
    const targetCat = catBySlug.get(targetSlug);

    if (oldCat && targetCat) {
      const moved = await prisma.product.updateMany({
        where: { categoryId: oldCat.id },
        data: { categoryId: targetCat.id },
      });
      if (moved.count > 0) {
        console.log(`[+] Migrados ${moved.count} productos de '${oldCat.name}' (${oldSlug}) -> '${targetCat.name}' (${targetSlug})`);
      }
    }
  }

  // 2. Desactivar y limpiar categorías obsoletas
  const obsoleteSlugs = Object.keys(migrations);
  const deactivated = await prisma.category.updateMany({
    where: { slug: { in: obsoleteSlugs } },
    data: { active: false },
  });
  console.log(`[+] Desactivadas ${deactivated.count} categorías obsoletas.`);

  // 3. Asegurar que las 9 categorías principales estén activas y en orden correcto
  const activeSlugs = [
    { slug: "brochas-y-esponjas", order: 0 },
    { slug: "rubor", order: 1 },
    { slug: "iluminador", order: 2 },
    { slug: "pestanas", order: 3 },
    { slug: "labios", order: 4 },
    { slug: "delineador", order: 5 },
    { slug: "bases-y-correctores", order: 6 },
    { slug: "contorno", order: 7 },
    { slug: "otros", order: 8 },
  ];

  for (const item of activeSlugs) {
    await prisma.category.updateMany({
      where: { slug: item.slug },
      data: { active: true, parentId: null, order: item.order },
    });
  }

  console.log("=== LIMPIEZA FINALIZADA CON ÉXITO ===");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
