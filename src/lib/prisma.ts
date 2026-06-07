import { PrismaClient, Prisma } from "@prisma/client";

/** Alias de Prisma.TransactionClient para usar en callbacks de $transaction sin escribir `any`. */
export type PrismaTransactionClient = Prisma.TransactionClient;
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
