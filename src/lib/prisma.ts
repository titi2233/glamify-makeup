import { PrismaClient, Prisma } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

export type PrismaTransactionClient = Prisma.TransactionClient;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL?.replace('?pgbouncer=true', ''), // usar transaction mode o session mode (ambos soportados en cloudflare si no se caen)
    max: 5,
    keepAlive: false,
    idleTimeoutMillis: 1, // Cerrar INMEDIATAMENTE después de usar, para que Cloudflare no mate el socket inactivo y genere Connection terminated
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
