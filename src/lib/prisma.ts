import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cache } from "react";

export type PrismaTransactionClient = Prisma.TransactionClient;

// ════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTE ARCHIVO NO TIENE UN CLIENTE GLOBAL
// ────────────────────────────────────────────────────────────────────────────
// En Cloudflare Workers un socket TCP (la conexión a Postgres) PERTENECE al
// request que lo abrió: no se puede reusar en otro request del mismo isolate.
// Cachear un Pool/PrismaClient a nivel de módulo (el patrón habitual en Node)
// hace que el request B reuse el socket del request A → el runtime lo prohíbe
// ("Cannot perform I/O on behalf of a different request") y, cuando el socket
// ya fue cerrado del lado del server, Prisma lo reporta como
// "Connection terminated unexpectedly".
//
// Además, entre requests el event loop del isolate está CONGELADO, así que los
// timers de limpieza de `pg` nunca corren → idleTimeoutMillis/keepAlive NO
// arreglan nada (callejones sin salida ya probados).
//
// Solución: crear el cliente POR-REQUEST. El cron ya lo hace así en
// src/lib/cron/deps.ts; esto replica ese patrón para el camino HTTP.
// Ref: opennext.js.org/cloudflare/howtos/db · prisma/prisma#28193 · workerd#423
// ════════════════════════════════════════════════════════════════════════════

/**
 * Resuelve el connection string en runtime, por-request.
 *
 * Orden de preferencia:
 *  1. Binding de Hyperdrive (`env.HYPERDRIVE`) si está configurado: mantiene un
 *     pool tibio en el edge y evita el handshake TCP por request. Es un BINDING,
 *     vive en `getCloudflareContext().env`, NO en `process.env`.
 *  2. `process.env.DATABASE_URL`: OpenNext inyecta vars y secrets en
 *     `process.env` en runtime. Es lo que usamos hoy (sin Hyperdrive).
 */
function resolveConnectionString(): string {
  try {
    const { env } = getCloudflareContext();
    const hyperdrive = (env as { HYPERDRIVE?: { connectionString?: string } })
      .HYPERDRIVE;
    if (hyperdrive?.connectionString) return hyperdrive.connectionString;
  } catch {
    // Sin contexto de Cloudflare (build, SSG en modo sync, o scripts de Node):
    // caemos a process.env, que siempre está disponible.
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no está definida");
  // El driver `pg` no entiende params solo-Prisma como `pgbouncer`; los quitamos.
  return url.replace("?pgbouncer=true", "");
}

/**
 * Cliente Prisma por-request. `cache()` de React lo memoiza dentro de UN request
 * (dedupe en Server Components / Server Actions / Route Handlers) y NUNCA entre
 * requests, que es exactamente lo que necesita Workers. No es un singleton de
 * módulo: no se instancia nada al importar este archivo.
 *
 * `new PrismaPg({ connectionString })` deja que el adapter sea dueño del pool
 * (no hace falta importar `pg` ni `new Pool`). Mismo patrón que el cron.
 */
export const getDb = cache((): PrismaClient => {
  const adapter = new PrismaPg({ connectionString: resolveConnectionString() });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
});

/**
 * Shim de compatibilidad. Mantiene la API `import { prisma } from "@/lib/prisma"`
 * usada en ~50 archivos, pero resuelve el cliente por-request de forma perezosa:
 * cada acceso a una propiedad (`prisma.product`, `prisma.$transaction`, ...)
 * pide el cliente del request actual vía `getDb()`. NO instancia nada en carga
 * de módulo, así que no abre ningún socket fuera de un request.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getDb();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
