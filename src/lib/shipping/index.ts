// NOTA: sin `import "server-only"` — este módulo lo importa también scripts/simulate-mp-webhook.ts (node).
// Es server por importar prisma indirectamente; ningún client component lo importa.
import { round2 } from "@/lib/money";
import { matchZone, isFreeShipping, methodFactor, orderWeightGr, type Zone } from "@/lib/shipping/quote";
import { quoteCorreo } from "@/lib/shipping/correo";
import type { CartLine } from "@/lib/cart/types";

export interface QuoteShippingInput {
  cp: string;
  province?: string | null;
  method: "domicilio" | "sucursal";
  lines: CartLine[];
  subtotal: number;
}
export interface ShippingQuote {
  cost: number;
  free: boolean;
  zoneId: string | null;
  source: "free" | "correo" | "zone" | "none";
}
export interface QuoteShippingDeps {
  getZones?: () => Promise<Zone[]>;
  getThreshold?: () => Promise<number>;
  correoQuote?: (input: { cpDestino: string; pesoGr: number; metodo: "domicilio" | "sucursal" }) => Promise<number | null>;
}

/** Orquesta el costo de envío: gratis por umbral → Correo (si configurado) → tabla de zonas. */
export async function quoteShipping(input: QuoteShippingInput, deps: QuoteShippingDeps = {}): Promise<ShippingQuote> {
  const getZones = deps.getZones ?? (async () => []);
  const getThreshold = deps.getThreshold ?? (async () => 0);
  const correoQuote = deps.correoQuote ?? quoteCorreo;

  const threshold = await getThreshold();
  if (isFreeShipping(input.subtotal, threshold)) {
    return { cost: 0, free: true, zoneId: null, source: "free" };
  }

  const pesoGr = orderWeightGr(input.lines);
  const factor = methodFactor(input.method);

  const correo = await correoQuote({ cpDestino: input.cp, pesoGr, metodo: input.method });
  if (correo != null) return { cost: round2(correo * factor), free: false, zoneId: null, source: "correo" };

  const zones = await getZones();
  const zone = matchZone(zones, { cp: input.cp, province: input.province });
  if (zone) return { cost: round2(Number(zone.price) * factor), free: false, zoneId: zone.id, source: "zone" };

  return { cost: 0, free: false, zoneId: null, source: "none" };
}
