import { PrismaClient, Prisma } from "@prisma/client/edge";

/** Alias de Prisma.TransactionClient para usar en callbacks de $transaction sin escribir `any`. */
export type PrismaTransactionClient = Prisma.TransactionClient;
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Driver adapter (@prisma/adapter-pg) para compatibilidad con Cloudflare Workers
// (blueprint 07 §1.3). DATABASE_URL apunta al pooler de Supabase (puerto 6543).
function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
