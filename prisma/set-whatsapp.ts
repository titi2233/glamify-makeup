/**
 * Fija el número real de WhatsApp en Setting (no hay aún UI de Settings en /admin).
 * Afecta el FAB de WhatsApp site-wide y `/contacto`. No destructivo (UPDATE de 1 fila).
 *
 * Uso:
 *   pnpm set:whatsapp 5492323582495        # solo dígitos, con código país (54) y de área sin 0/15
 *
 * Si no se pasa número, solo muestra el valor actual.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const raw = process.argv[2];
const digits = raw ? raw.replace(/\D/g, "") : undefined;

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ Falta DIRECT_URL/DATABASE_URL. Corré con: tsx --env-file=.env prisma/set-whatsapp.ts <numero>");
  process.exit(1);
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const current = await prisma.setting.findUnique({ where: { id: "default" }, select: { whatsappNumber: true } });
  console.log(`WhatsApp actual: ${current?.whatsappNumber ?? "(sin fila Setting)"}`);

  if (!digits) {
    console.log("No se pasó número nuevo. Uso: pnpm set:whatsapp 5492323582495");
    return;
  }
  if (digits.length < 11 || digits.length > 15) {
    console.error(`❌ "${digits}" no parece un número válido (esperado 11-15 dígitos con código país).`);
    process.exit(1);
  }

  const updated = await prisma.setting.upsert({
    where: { id: "default" },
    update: { whatsappNumber: digits },
    create: { id: "default", whatsappNumber: digits },
    select: { whatsappNumber: true },
  });
  console.log(`✅ WhatsApp nuevo: ${updated.whatsappNumber}`);
}

main()
  .catch((e) => {
    console.error("❌ Falló:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
