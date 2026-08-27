// NOTA: sin `import "server-only"` — este módulo lo importa también scripts/simulate-mp-webhook.ts (node).
// Es server por importar prisma indirectamente; ningún client component lo importa.
import { round2 } from "@/lib/money";
import { matchZone, isFreeShipping, methodFactor, orderWeightGr, type Zone } from "@/lib/shipping/quote";
import { quoteMicorreo } from "@/lib/shipping/micorreo";
import type { CartLine } from "@/lib/cart/types";

/** Opción ganadora normalizada de un proveedor de cotización en vivo (forma genérica, no atada a un vendor). */
export interface LiveQuote {
  /** Precio final con impuestos, en ARS. Es lo que se le cobra a la clienta. */
  cost: number;
  /** Operador que gana la cotización (ej. "OCA", "Correo Argentino"). */
  carrier: string;
  /** Fecha estimada de entrega (ISO 8601) o null si el proveedor no la informa. */
  estimatedDelivery: string | null;
}

export interface QuoteShippingInput {
  cp: string;
  province?: string | null;
  /** Localidad: algunos proveedores en vivo la exigen junto con la provincia. Sin ella cae a zonas. */
  city?: string | null;
  method: "domicilio" | "sucursal";
  lines: CartLine[];
  subtotal: number;
}
export interface ShippingQuote {
  cost: number;
  free: boolean;
  zoneId: string | null;
  source: "free" | "live" | "zone" | "none";
  /** Sólo con cotización en vivo: operador y fecha estimada. */
  carrier?: string;
  estimatedDelivery?: string | null;
}
export interface QuoteShippingDeps {
  getZones?: () => Promise<Zone[]>;
  getThreshold?: () => Promise<number>;
  liveQuote?: (input: {
    cpDestino: string;
    localidad: string;
    provincia: string;
    pesoGr: number;
    metodo: "domicilio" | "sucursal";
    valorDeclarado: number;
  }) => Promise<LiveQuote | null>;
}

// Proveedor en vivo por defecto: API oficial de MiCorreo (ver docs/decisions/0001-shipping-provider.md).
// Sin credenciales en el entorno, quoteMicorreo devuelve null y todo cae a la tabla de zonas.
// MiCorreo sólo necesita CP, peso y método; el resto de los campos del contrato se ignoran.
const DEFAULT_LIVE_QUOTE: NonNullable<QuoteShippingDeps["liveQuote"]> = ({ cpDestino, pesoGr, metodo }) =>
  quoteMicorreo({ cpDestino, pesoGr, metodo });

/** Orquesta el costo de envío: gratis por umbral → cotización en vivo (si se inyecta un proveedor) → tabla de zonas. */
export async function quoteShipping(input: QuoteShippingInput, deps: QuoteShippingDeps = {}): Promise<ShippingQuote> {
  const getZones = deps.getZones ?? (async () => []);
  const getThreshold = deps.getThreshold ?? (async () => 0);
  const liveQuote = deps.liveQuote ?? DEFAULT_LIVE_QUOTE;

  const threshold = await getThreshold();
  if (isFreeShipping(input.subtotal, threshold)) {
    return { cost: 0, free: true, zoneId: null, source: "free" };
  }

  const pesoGr = orderWeightGr(input.lines);

  const live = await liveQuote({
    cpDestino: input.cp,
    localidad: input.city ?? "",
    provincia: input.province ?? "",
    pesoGr,
    metodo: input.method,
    valorDeclarado: input.subtotal,
  });
  // Sin methodFactor: un proveedor en vivo cotiza domicilio y sucursal por separado con su
  // precio real. Aplicarlo encima descontaría dos veces.
  if (live) {
    return {
      cost: round2(live.cost),
      free: false,
      zoneId: null,
      source: "live",
      carrier: live.carrier,
      estimatedDelivery: live.estimatedDelivery,
    };
  }

  // Fallback: tabla de zonas, donde el factor sí hace falta porque la tabla
  // guarda un solo precio por zona.
  const zones = await getZones();
  const zone = matchZone(zones, { cp: input.cp, province: input.province });
  if (zone) {
    return { cost: round2(Number(zone.price) * methodFactor(input.method)), free: false, zoneId: zone.id, source: "zone" };
  }

  return { cost: 0, free: false, zoneId: null, source: "none" };
}
