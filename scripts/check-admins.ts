import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const users = await prisma.user.findMany();
  console.log("=== Usuarios admin en la DB ===");
  if (users.length === 0) {
    console.log("No hay ningún usuario admin registrado.");
  } else {
    for (const u of users) {
      console.log(`  Email: ${u.email} | Rol: ${u.role} | ID: ${u.id}`);
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
