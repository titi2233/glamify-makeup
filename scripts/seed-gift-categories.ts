import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { confirmProdWrite } from "./prod-write-guard";

/**
 * Crea (o actualiza, si ya existen) las 4 categorías de "Especial Regalos" del home.
 * Idempotente: upsert por slug — correr de nuevo no duplica nada.
 *
 * Requiere que la migración de `ProductCategory` / `Category.showInMenu` ya esté aplicada
 * (`pnpm db:migrate`) antes de correr este script.
 *
 * Uso: pnpm tsx --env-file=.env scripts/seed-gift-categories.ts
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

interface GiftCategory {
  slug: string;
  name: string;
  skuPrefix: string;
  order: number;
}

// Orden alto (900+) para que no se mezclen con las categorías de producto del menú principal
// en ningún listado que no filtre por showInMenu.
const GIFT_CATEGORIES: GiftCategory[] = [
  { slug: "lip-combos", name: "Lip Combo's", skuPrefix: "LPC", order: 900 },
  { slug: "gift-cards", name: "Gift Cards", skuPrefix: "GFC", order: 901 },
  { slug: "ramos-maquillaje", name: "Ramos de Maquillaje", skuPrefix: "RAM", order: 902 },
  { slug: "box-maquillaje", name: "Box de Maquillaje", skuPrefix: "BOX", order: 903 },
];

async function main(): Promise<void> {
  await confirmProdWrite("crear las 4 categorías de Especial Regalos (lip-combos, gift-cards, ramos-maquillaje, box-maquillaje)");
  console.log("🎁 Creando categorías de Especial Regalos…");

  for (const c of GIFT_CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, skuPrefix: c.skuPrefix, order: c.order, active: true, showInMenu: false },
      create: { slug: c.slug, name: c.name, skuPrefix: c.skuPrefix, order: c.order, parentId: null, active: true, showInMenu: false },
    });
    console.log(`  ✓ ${c.name} (${row.id})`);
  }

  console.log("Listo. Quedan ocultas del menú principal (showInMenu: false) pero visibles en /tienda/<slug>.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
