import { describe, it, expect } from "vitest";
import {
  PAID_PLUS_STATUSES,
  sumSalesInRange,
  computeSalesBuckets,
  countPendingActions,
  averageTicket,
  topProducts,
  criticalStock,
  type DashboardOrderRow,
  type DashboardOrderItemRow,
  type DashboardVariantRow,
} from "@/lib/admin/dashboard/stats";

const order = (over: Partial<DashboardOrderRow> = {}): DashboardOrderRow => ({
  total: 1000,
  status: "paid",
  createdAt: new Date("2026-06-05T12:00:00Z"),
  ...over,
});

describe("PAID_PLUS_STATUSES", () => {
  it("son los estados que alcanzaron pago", () => {
    expect(PAID_PLUS_STATUSES).toEqual(["paid", "preparing", "shipped", "delivered"]);
  });
});

describe("sumSalesInRange", () => {
  it("suma total de pedidos paid+ con createdAt >= from", () => {
    const from = new Date("2026-06-05T03:00:00Z");
    const rows = [
      order({ total: 1000, createdAt: new Date("2026-06-05T12:00:00Z") }), // dentro
      order({ total: 500, createdAt: new Date("2026-06-04T12:00:00Z") }),  // antes de from
      order({ total: 2000, status: "delivered", createdAt: new Date("2026-06-05T20:00:00Z") }), // dentro
    ];
    expect(sumSalesInRange(rows, from)).toBe(3000);
  });

  it("ignora pedidos que no alcanzaron pago", () => {
    const from = new Date("2026-06-05T03:00:00Z");
    const rows = [
      order({ total: 1000, status: "pending_payment" }),
      order({ total: 1000, status: "cancelled" }),
      order({ total: 1000, status: "refunded" }),
    ];
    expect(sumSalesInRange(rows, from)).toBe(0);
  });

  it("normaliza montos en string (Decimal)", () => {
    const from = new Date("2026-06-05T03:00:00Z");
    const rows = [order({ total: "1500.50" as unknown as number })];
    expect(sumSalesInRange(rows, from)).toBe(1500.5);
  });
});

describe("computeSalesBuckets", () => {
  it("calcula ventas de hoy, semana y mes desde un único set de filas", () => {
    // Usamos viernes 19-jun para que la semana (lun 15) y el mes (1-jun) sean distintos
    const now = new Date("2026-06-19T12:00:00Z"); // viernes 09:00 ART, 19-jun
    const rows = [
      order({ total: 1000, createdAt: new Date("2026-06-19T13:00:00Z") }), // hoy (19-jun)
      order({ total: 2000, createdAt: new Date("2026-06-16T13:00:00Z") }), // esta semana (martes 16-jun), no hoy
      order({ total: 4000, createdAt: new Date("2026-06-03T13:00:00Z") }), // este mes (3-jun), no esta semana
      order({ total: 8000, createdAt: new Date("2026-05-10T13:00:00Z") }), // mes anterior (may)
    ];
    const b = computeSalesBuckets(rows, now);
    expect(b.today).toBe(1000);
    expect(b.week).toBe(3000); // hoy + martes
    expect(b.month).toBe(7000); // hoy + martes + 3-jun
  });
});

describe("countPendingActions", () => {
  it("cuenta paid (a preparar) y preparing (a despachar)", () => {
    const rows = [
      order({ status: "paid" }),
      order({ status: "paid" }),
      order({ status: "preparing" }),
      order({ status: "shipped" }),
      order({ status: "pending_payment" }),
    ];
    expect(countPendingActions(rows)).toEqual({ toPrepare: 2, toDispatch: 1 });
  });
});

describe("averageTicket", () => {
  it("promedia total de pedidos paid+ con createdAt >= from", () => {
    const from = new Date("2026-06-01T03:00:00Z");
    const rows = [
      order({ total: 1000, createdAt: new Date("2026-06-05T12:00:00Z") }),
      order({ total: 3000, createdAt: new Date("2026-06-06T12:00:00Z") }),
      order({ total: 9999, status: "cancelled", createdAt: new Date("2026-06-06T12:00:00Z") }),
    ];
    expect(averageTicket(rows, from)).toBe(2000);
  });

  it("0 cuando no hay pedidos en el rango", () => {
    expect(averageTicket([], new Date("2026-06-01T03:00:00Z"))).toBe(0);
  });

  it("redondea a 2 decimales", () => {
    const from = new Date("2026-06-01T03:00:00Z");
    const rows = [order({ total: 1000 }), order({ total: 1000 }), order({ total: 1001 })];
    expect(averageTicket(rows, from)).toBe(1000.33);
  });
});

describe("topProducts", () => {
  const item = (over: Partial<DashboardOrderItemRow> = {}): DashboardOrderItemRow => ({
    productNameSnapshot: "Labial Mate",
    variantNameSnapshot: "Rojo",
    qty: 1,
    ...over,
  });

  it("suma qty por nombre de producto+variante y ordena desc", () => {
    const rows = [
      item({ productNameSnapshot: "Labial Mate", variantNameSnapshot: "Rojo", qty: 2 }),
      item({ productNameSnapshot: "Labial Mate", variantNameSnapshot: "Rojo", qty: 3 }),
      item({ productNameSnapshot: "Rubor", variantNameSnapshot: null, qty: 10 }),
    ];
    const top = topProducts(rows, 5);
    expect(top[0]).toEqual({ label: "Rubor", qty: 10 });
    expect(top[1]).toEqual({ label: "Labial Mate — Rojo", qty: 5 });
  });

  it("respeta el límite", () => {
    const rows = [
      item({ productNameSnapshot: "A", variantNameSnapshot: null, qty: 3 }),
      item({ productNameSnapshot: "B", variantNameSnapshot: null, qty: 2 }),
      item({ productNameSnapshot: "C", variantNameSnapshot: null, qty: 1 }),
    ];
    expect(topProducts(rows, 2)).toHaveLength(2);
  });
});

describe("criticalStock", () => {
  const variant = (over: Partial<DashboardVariantRow> = {}): DashboardVariantRow => ({
    id: "v1",
    productName: "Labial Mate",
    variantName: "Rojo",
    sku: "LAB-0001",
    stock: 1,
    lowStockThreshold: 3,
    ...over,
  });

  it("incluye variantes con stock <= umbral, ordenadas por stock asc", () => {
    const rows = [
      variant({ id: "a", stock: 3, lowStockThreshold: 3 }),
      variant({ id: "b", stock: 0, lowStockThreshold: 3 }),
      variant({ id: "c", stock: 5, lowStockThreshold: 3 }), // fuera (5 > 3)
    ];
    const crit = criticalStock(rows);
    expect(crit.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("vacío cuando todo está por encima del umbral", () => {
    expect(criticalStock([variant({ stock: 10, lowStockThreshold: 3 })])).toEqual([]);
  });
});
