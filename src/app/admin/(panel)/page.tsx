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
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { getDashboardData } from "@/lib/admin/dashboard/queries";
import { formatARS } from "@/lib/money";

export const dynamic = "force-dynamic";

/** Encabezado de sección del dashboard: medallón chico + título serif. */
function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 font-display text-lg font-semibold text-foreground">
      <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden>
        <Icon className="size-[18px]" />
      </span>
      {children}
    </h2>
  );
}

/** Card con cabecera + lista (más vendidos / stock bajo). */
function PanelCard({
  icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="admin-card overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft">
      <header className="border-b border-border/70 bg-surface-alt/60 px-5 py-3.5">
        <SectionTitle icon={icon}>{title}</SectionTitle>
      </header>
      {children}
    </section>
  );
}

export default async function AdminDashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="stagger space-y-8">
      <PageHeader
        icon={LayoutDashboard}
        title="Inicio"
        subtitle="Un vistazo rápido a tus ventas y a lo que tenés que hacer hoy."
      />

      {/* Ventas */}
      <section className="space-y-3">
        <SectionTitle icon={DollarSign}>Ventas</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard title="Ventas de hoy" value={formatARS(data.sales.today)} hint="Lo que vendiste desde la medianoche." icon={DollarSign} />
          <StatCard title="Ventas de la semana" value={formatARS(data.sales.week)} hint="Desde el lunes hasta ahora." icon={CalendarRange} />
          <StatCard title="Ventas del mes" value={formatARS(data.sales.month)} hint="Desde el día 1 del mes." icon={CalendarDays} />
        </div>
      </section>

      {/* Pendientes + ticket */}
      <section className="space-y-3">
        <SectionTitle icon={PackageCheck}>Para hacer</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard title="Pedidos a preparar" value={String(data.pending.toPrepare)} hint="Ya pagados, esperando que los armes." icon={PackageCheck} />
          <StatCard title="Pedidos a despachar" value={String(data.pending.toDispatch)} hint="Armados, listos para enviar." icon={Truck} />
          <StatCard title="Ticket promedio (mes)" value={formatARS(data.averageTicketMonth)} hint="Cuánto gasta en promedio cada clienta." icon={Receipt} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top productos */}
        <PanelCard icon={TrendingUp} title="Más vendidos del mes">
          {data.topProductsMonth.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              Todavía no hay ventas este mes. Cuando vendas, acá vas a ver tus productos más pedidos.
            </p>
          ) : (
            <ul className="divide-y divide-border/70">
              {data.topProductsMonth.map((p, i) => (
                <li key={p.label} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className="icon-medallion grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{p.label}</span>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-foreground tabular-nums">
                    {p.qty} u.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>

        {/* Stock crítico */}
        <PanelCard icon={AlertTriangle} title="Stock bajo">
          {data.criticalStock.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              Todo en orden: ningún producto está por debajo de su stock mínimo.
            </p>
          ) : (
            <ul className="divide-y divide-border/70">
              {data.criticalStock.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <Link
                    href="/admin/productos"
                    className="min-w-0 truncate text-sm font-medium text-primary-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {v.label}
                    <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">{v.sku}</span>
                  </Link>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 tabular-nums">
                    <AlertTriangle className="size-3" aria-hidden />
                    {v.stock} en stock
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>
      </div>
    </div>
  );
}
