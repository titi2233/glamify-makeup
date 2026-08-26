import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { sendEmail as realSendEmail, type SendEmailInput } from "@/lib/email/resend";
import type { AbandonedJobDeps } from "@/lib/cart/abandoned-job";
import type { ExpiryJobDeps } from "@/lib/orders/expiry-job";

export interface CronEnv {
  DATABASE_URL?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  NEXT_PUBLIC_APP_URL?: string;
}

/** Construye deps reales para los jobs del cron desde el `env` del Worker. */
export function buildCronDeps(env: CronEnv): { abandoned: AbandonedJobDeps; expiry: ExpiryJobDeps } {
  let ClientClass: typeof PrismaClient;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ClientClass = require("@prisma/client/wasm").PrismaClient;
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ClientClass = require("@prisma/client").PrismaClient;
  }
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL ?? process.env.DATABASE_URL });
  const db = new ClientClass({ adapter });
  const now = new Date();
  const appUrl = env.NEXT_PUBLIC_APP_URL ?? "https://glamifymakeup.site";
  const sendEmail = (input: SendEmailInput) =>
    realSendEmail(input, { apiKey: env.RESEND_API_KEY, defaultFrom: env.RESEND_FROM });
  return {
    abandoned: { db: db as never, sendEmail, now, appUrl },
    expiry: { db: db as never, now },
  };
}
