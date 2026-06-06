// Worker entry custom: re-exporta el handler de @opennextjs/cloudflare y agrega `scheduled`
// para los Cron Triggers (carrito abandonado + autocancelación). Ver spec M4 §9.
// El artefacto .open-next/worker.js se genera con `pnpm build:worker` (no existe en dev de Next).
// @ts-ignore - generado en build
import openNextHandler from "./.open-next/worker.js";
import { buildCronDeps, type CronEnv } from "./src/lib/cron/deps";
import { runAbandonedCartJob } from "./src/lib/cart/abandoned-job";
import { runOrderExpiryJob } from "./src/lib/orders/expiry-job";

export default {
  fetch: (openNextHandler as { fetch: ExportedHandlerFetchHandler }).fetch,
  async scheduled(_controller: ScheduledController, env: CronEnv, ctx: ExecutionContext) {
    const deps = buildCronDeps(env);
    ctx.waitUntil(
      Promise.allSettled([
        runAbandonedCartJob(deps.abandoned),
        runOrderExpiryJob(deps.expiry),
      ]).then((results) => {
        for (const r of results) if (r.status === "rejected") console.error("[cron]", r.reason);
      }),
    );
  },
} satisfies ExportedHandler<CronEnv>;
