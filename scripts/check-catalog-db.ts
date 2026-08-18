import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const categories = await prisma.category.findMany({
    where: { parentId: null },
    include: { children: true },
  });
  console.log("=== Categorías en la Base de Datos ===");
  for (const cat of categories) {
    console.log(`- [${cat.skuPrefix}] ${cat.name} (id: ${cat.id}, slug: ${cat.slug})`);
    for (const child of cat.children) {
      console.log(`   └─ [${child.skuPrefix}] ${child.name} (id: ${child.id}, slug: ${child.slug})`);
    }
  }

  const productCount = await prisma.product.count({ where: { deletedAt: null } });
  console.log(`\nTotal de productos actuales en DB: ${productCount}`);

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    include: { category: true, variants: true },
  });
  for (const p of products) {
    console.log(`* ${p.name} | Cat: ${p.category.name} | $${p.basePrice} | Variantes: ${p.variants.length}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
