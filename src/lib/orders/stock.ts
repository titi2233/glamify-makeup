import type { CartLine } from "@/lib/cart/types";

/** Cantidad a descontar por variante (combos expandidos a sus componentes). */
export function computeStockDecrements(lines: CartLine[]): Map<string, number> {
  const m = new Map<string, number>();
  const add = (variantId: string, qty: number) => m.set(variantId, (m.get(variantId) ?? 0) + qty);
  for (const l of lines) {
    if (l.kind === "variant") add(l.refId, l.qty);
    else for (const c of l.components ?? []) add(c.variantId, c.qty * l.qty);
  }
  return m;
}

export interface Shortage {
  variantId: string;
  needed: number;
  available: number;
}
export interface AvailabilityResult {
  ok: boolean;
  shortages: Shortage[];
}

/** ¿Alcanza el stock actual para los decrementos pedidos? Reporta faltantes (oversell). */
export function checkAvailability(decrements: Map<string, number>, currentStock: Map<string, number>): AvailabilityResult {
  const shortages: Shortage[] = [];
  for (const [variantId, needed] of decrements) {
    const available = currentStock.get(variantId) ?? 0;
    if (available < needed) shortages.push({ variantId, needed, available });
  }
  return { ok: shortages.length === 0, shortages };
}
