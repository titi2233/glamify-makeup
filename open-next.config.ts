import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Config de OpenNext para Cloudflare Workers (blueprint 07 §1.2).
// Cache incremental (ISR) se puede enchufar a R2/KV en milestones posteriores.
export default defineCloudflareConfig();
