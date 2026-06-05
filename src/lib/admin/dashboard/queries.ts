import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/catalog/pricing";
import { startOfMonthART } from "@/lib/admin/dashboard/dates";
import {
  PAID_PLUS_STATUSES,
  computeSalesBuckets,
  countPendingActions,
  averageTicket,
  topProducts,
  criticalStock,
  type DashboardOrderRow,
  type DashboardOrderItemRow,
  type DashboardVariantRow,
  type SalesBuckets,
  type PendingActions,
  type TopProduct,
  type CriticalStockEntry,
} from "@/lib/admin/dashboard/stats";

export interface DashboardData {
  sales: SalesBuckets;
  pending: PendingActions;
  averageTicketMonth: number;
  topProductsMonth: TopProduct[];
  criticalStock: CriticalStockEntry[];
}

const TOP_PRODUCTS_LIMIT = 5;
const CRITICAL_STOCK_LIMIT = 20;

/** Reúne todos los datos del dashboard. `now` permite testear/forzar el instante de referencia. */
export async function getDashboardData(now: Date = new Date()): Promise<DashboardData> {
  const monthStart = startOfMonthART(now);

  // Pedidos del mes en curso (cubre hoy/semana/mes: todos los buckets caen dentro del mes ART).
  const monthOrders = await prisma.order.findMany({
    where: { createdAt: { gte: monthStart } },
    select: { total: true, status: true, createdAt: true },
  });
  const orderRows: DashboardOrderRow[] = monthOrders.map((o) => ({
    total: toNumber(o.total),
    status: o.status,
    createdAt: o.createdAt,
  }));

  // Pendientes de acción: estado puntual, no acotado por fecha.
  const pendingOrders = await prisma.order.findMany({
    where: { status: { in: ["paid", "preparing"] } },
    select: { total: true, status: true, createdAt: true },
  });
  const pendingRows: DashboardOrderRow[] = pendingOrders.map((o) => ({
    total: toNumber(o.total),
    status: o.status,
    createdAt: o.createdAt,
  }));

  // Ítems de pedidos paid+ del mes, para top productos.
  const items = await prisma.orderItem.findMany({
    where: {
      order: { status: { in: PAID_PLUS_STATUSES }, createdAt: { gte: monthStart } },
    },
    select: { productNameSnapshot: true, variantNameSnapshot: true, qty: true },
  });
  const itemRows: DashboardOrderItemRow[] = items.map((i) => ({
    productNameSnapshot: i.productNameSnapshot,
    variantNameSnapshot: i.variantNameSnapshot,
    qty: i.qty,
  }));

  // Variantes activas con stock crítico (stock <= umbral), filtrado fino en SQL.
  const variants = await prisma.productVariant.findMany({
    where: { active: true, product: { deletedAt: null, active: true } },
    select: {
      id: true,
      name: true,
      sku: true,
      stock: true,
      lowStockThreshold: true,
      product: { select: { name: true } },
    },
  });
  const variantRows: DashboardVariantRow[] = variants.map((v) => ({
    id: v.id,
    productName: v.product.name,
    variantName: v.name,
    sku: v.sku,
    stock: v.stock,
    lowStockThreshold: v.lowStockThreshold,
  }));

  return {
    sales: computeSalesBuckets(orderRows, now),
    pending: countPendingActions(pendingRows),
    averageTicketMonth: averageTicket(orderRows, monthStart),
    topProductsMonth: topProducts(itemRows, TOP_PRODUCTS_LIMIT),
    criticalStock: criticalStock(variantRows).slice(0, CRITICAL_STOCK_LIMIT),
  };
}
