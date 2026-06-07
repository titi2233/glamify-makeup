import { PrismaClient, Prisma } from "@prisma/client";

/** Alias de Prisma.TransactionClient para usar en callbacks de $transaction sin escribir `any`. */
export type PrismaTransactionClient = Prisma.TransactionClient;
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Driver adapter (@prisma/adapter-pg) para compatibilidad con Cloudflare Workers
// Limitamos el max a 1 para no exceder el límite de sockets TCP simultáneos (6) de Cloudflare Workers.
function createPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    idleTimeoutMillis: 500, // Cerrar rápido para evitar que el Worker intente reusar sockets "congelados" y falle con Connection terminated
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false },
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
