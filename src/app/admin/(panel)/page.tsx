import Link from "next/link";
import {
  DollarSign,
  CalendarRange,
  CalendarDays,
  PackageCheck,
  Truck,
  Receipt,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { getDashboardData } from "@/lib/admin/dashboard/queries";
import { formatARS } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Inicio"
        subtitle="Un vistazo rápido a tus ventas y a lo que tenés que hacer hoy."
      />

      {/* Ventas */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Ventas</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            title="Ventas de hoy"
            value={formatARS(data.sales.today)}
            hint="Lo que vendiste desde la medianoche."
            icon={DollarSign}
          />
          <StatCard
            title="Ventas de la semana"
            value={formatARS(data.sales.week)}
            hint="Desde el lunes hasta ahora."
            icon={CalendarRange}
          />
          <StatCard
            title="Ventas del mes"
            value={formatARS(data.sales.month)}
            hint="Desde el día 1 del mes."
            icon={CalendarDays}
          />
        </div>
      </section>

      {/* Pendientes + ticket */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Para hacer</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            title="Pedidos a preparar"
            value={String(data.pending.toPrepare)}
            hint="Ya pagados, esperando que los armes."
            icon={PackageCheck}
          />
          <StatCard
            title="Pedidos a despachar"
            value={String(data.pending.toDispatch)}
            hint="Armados, listos para enviar."
            icon={Truck}
          />
          <StatCard
            title="Ticket promedio (mes)"
            value={formatARS(data.averageTicketMonth)}
            hint="Cuánto gasta en promedio cada clienta."
            icon={Receipt}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top productos */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <TrendingUp className="size-5 text-primary" aria-hidden />
            Más vendidos del mes
          </h2>
          <Card>
            <CardContent className="p-0">
              {data.topProductsMonth.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  Todavía no hay ventas este mes. Cuando vendas, acá vas a ver tus productos más pedidos.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.topProductsMonth.map((p) => (
                    <li key={p.label} className="flex items-center justify-between gap-4 px-5 py-3">
                      <span className="min-w-0 truncate text-sm">{p.label}</span>
                      <span className="shrink-0 text-sm font-semibold">{p.qty} u.</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Stock crítico */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <AlertTriangle className="size-5 text-primary" aria-hidden />
            Stock bajo
          </h2>
          <Card>
            <CardContent className="p-0">
              {data.criticalStock.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  Todo en orden: ningún producto está por debajo de su stock mínimo.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.criticalStock.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-4 px-5 py-3">
                      <Link
                        href="/admin/productos"
                        className="min-w-0 truncate text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {v.label}
                        <span className="ml-2 text-xs text-muted-foreground">{v.sku}</span>
                      </Link>
                      <span className="shrink-0 text-sm font-semibold text-destructive">
                        {v.stock} en stock
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
