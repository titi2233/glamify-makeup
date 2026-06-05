// NOTA: sin `import "server-only"` — lo importa scripts/simulate-mp-webhook.ts (node). Server por importar prisma.
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/catalog/pricing";
import type { Zone } from "@/lib/shipping/quote";

export async function getShippingZonesForQuote(): Promise<Zone[]> {
  const zones = await prisma.shippingZone.findMany({ where: { active: true }, orderBy: { order: "asc" } });
  return zones.map((z) => ({
    id: z.id, matchType: z.matchType, provinces: z.provinces,
    cpFrom: z.cpFrom, cpTo: z.cpTo, price: toNumber(z.price), active: z.active, order: z.order,
  }));
}

export async function getFreeShippingThreshold(): Promise<number> {
  const setting = await prisma.setting.findUnique({ where: { id: "default" } });
  return setting ? toNumber(setting.freeShippingThreshold) : 47500;
}
