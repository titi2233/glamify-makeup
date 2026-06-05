import type { OrderStatus } from "@prisma/client";
import { toNumber } from "@/lib/catalog/pricing";
import { round2 } from "@/lib/money";
import { startOfDayART, startOfWeekART, startOfMonthART } from "@/lib/admin/dashboard/dates";

/** Estados que ya alcanzaron pago (cuentan como venta). */
export const PAID_PLUS_STATUSES: OrderStatus[] = ["paid", "preparing", "shipped", "delivered"];

function isPaidPlus(status: OrderStatus): boolean {
  return PAID_PLUS_STATUSES.includes(status);
}

/** Fila mínima de pedido para las agregaciones. */
export interface DashboardOrderRow {
  total: number | string;
  status: OrderStatus;
  createdAt: Date;
}

/** Fila mínima de ítem de pedido (snapshots). */
export interface DashboardOrderItemRow {
  productNameSnapshot: string;
  variantNameSnapshot: string | null;
  qty: number;
}

/** Fila mínima de variante para stock crítico. */
export interface DashboardVariantRow {
  id: string;
  productName: string;
  variantName: string;
  sku: string;
  stock: number;
  lowStockThreshold: number;
}

export interface SalesBuckets {
  today: number;
  week: number;
  month: number;
}

export interface PendingActions {
  toPrepare: number;
  toDispatch: number;
}

export interface TopProduct {
  label: string;
  qty: number;
}

export interface CriticalStockEntry {
  id: string;
  label: string;
  sku: string;
  stock: number;
  lowStockThreshold: number;
}

/** Suma `total` de pedidos paid+ con `createdAt >= from`. */
export function sumSalesInRange(rows: DashboardOrderRow[], from: Date): number {
  let sum = 0;
  for (const r of rows) {
    if (isPaidPlus(r.status) && r.createdAt.getTime() >= from.getTime()) {
      sum += toNumber(r.total);
    }
  }
  return round2(sum);
}

/** Ventas de hoy / semana / mes (ART) a partir de un único set de pedidos. */
export function computeSalesBuckets(rows: DashboardOrderRow[], now: Date): SalesBuckets {
  return {
    today: sumSalesInRange(rows, startOfDayART(now)),
    week: sumSalesInRange(rows, startOfWeekART(now)),
    month: sumSalesInRange(rows, startOfMonthART(now)),
  };
}

/** Conteo de pedidos pendientes de acción: paid (a preparar) y preparing (a despachar). */
export function countPendingActions(rows: DashboardOrderRow[]): PendingActions {
  let toPrepare = 0;
  let toDispatch = 0;
  for (const r of rows) {
    if (r.status === "paid") toPrepare += 1;
    else if (r.status === "preparing") toDispatch += 1;
  }
  return { toPrepare, toDispatch };
}

/** Ticket promedio: promedio de `total` de pedidos paid+ con `createdAt >= from`. */
export function averageTicket(rows: DashboardOrderRow[], from: Date): number {
  let sum = 0;
  let count = 0;
  for (const r of rows) {
    if (isPaidPlus(r.status) && r.createdAt.getTime() >= from.getTime()) {
      sum += toNumber(r.total);
      count += 1;
    }
  }
  if (count === 0) return 0;
  return round2(sum / count);
}

/** Top productos por qty vendida (nombre producto + variante), orden desc, limitado. */
export function topProducts(items: DashboardOrderItemRow[], limit: number): TopProduct[] {
  const byLabel = new Map<string, number>();
  for (const it of items) {
    const label = it.variantNameSnapshot
      ? `${it.productNameSnapshot} — ${it.variantNameSnapshot}`
      : it.productNameSnapshot;
    byLabel.set(label, (byLabel.get(label) ?? 0) + it.qty);
  }
  return [...byLabel.entries()]
    .map(([label, qty]) => ({ label, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit);
}

/** Variantes con stock crítico (stock <= umbral), ordenadas por stock ascendente. */
export function criticalStock(rows: DashboardVariantRow[]): CriticalStockEntry[] {
  return rows
    .filter((r) => r.stock <= r.lowStockThreshold)
    .sort((a, b) => a.stock - b.stock)
    .map((r) => ({
      id: r.id,
      label: r.variantName ? `${r.productName} — ${r.variantName}` : r.productName,
      sku: r.sku,
      stock: r.stock,
      lowStockThreshold: r.lowStockThreshold,
    }));
}
