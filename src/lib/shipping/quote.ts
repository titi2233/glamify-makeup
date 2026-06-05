import type { CartLine } from "@/lib/cart/types";

export const DEFAULT_WEIGHT_GR = 50;

/** Peso total del pedido en gramos (default sensato si falta; maquillaje liviano). Nunca 0. */
export function orderWeightGr(lines: CartLine[]): number {
  const total = lines.reduce((acc, l) => acc + (l.weightGr > 0 ? l.weightGr : DEFAULT_WEIGHT_GR) * l.qty, 0);
  return total > 0 ? total : DEFAULT_WEIGHT_GR;
}

/** Forma mínima de ShippingZone necesaria para el match (compatible con Prisma). */
export interface Zone {
  id: string;
  matchType: "province" | "cpRange";
  provinces: string[];
  cpFrom: string | null;
  cpTo: string | null;
  price: number | string;
  active: boolean;
  order: number;
}
export interface ZoneMatchInput {
  cp: string;
  province?: string | null;
}

function cpInRange(cp: string, from: string | null, to: string | null): boolean {
  const n = parseInt(cp, 10);
  if (Number.isNaN(n) || from == null || to == null) return false;
  return n >= parseInt(from, 10) && n <= parseInt(to, 10);
}

/** Primera zona activa (por `order`) que matchea el CP (cpRange) o la provincia (province). */
export function matchZone(zones: Zone[], input: ZoneMatchInput): Zone | null {
  const candidates = zones.filter((z) => z.active).sort((a, b) => a.order - b.order);
  for (const z of candidates) {
    if (z.matchType === "cpRange" && cpInRange(input.cp, z.cpFrom, z.cpTo)) return z;
    if (z.matchType === "province" && input.province && z.provinces.includes(input.province)) return z;
  }
  return null;
}

/** Envío gratis si el subtotal alcanza el umbral configurable (>0). */
export function isFreeShipping(subtotal: number, threshold: number): boolean {
  return threshold > 0 && subtotal >= threshold;
}

/** Factor de costo por método: sucursal de Correo suele ser más barata que domicilio (blueprint 05 §3). */
export function methodFactor(method: "domicilio" | "sucursal"): number {
  return method === "sucursal" ? 0.85 : 1;
}
