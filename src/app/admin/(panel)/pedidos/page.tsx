import Link from "next/link";
import {
  ShoppingCart,
  Search,
  SlidersHorizontal,
  Clock,
  CircleDollarSign,
  PackageOpen,
  Truck,
  PackageCheck,
  XCircle,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { formatARS } from "@/lib/money";
import { toNumber } from "@/lib/catalog/pricing";
import { STATUS_LABELS } from "@/lib/admin/orders/service";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Presentación de cada estado de pedido: variante de Badge (color) + ícono lucide.
 * El ícono+texto del Badge garantiza que el color NUNCA sea el único indicador (a11y).
 * No cambia los valores de OrderStatus ni la máquina de estados.
 */
const STATUS_PRESENTATION: Record<OrderStatus, { variant: BadgeProps["variant"]; icon: LucideIcon }> = {
  pending_payment: { variant: "warning", icon: Clock },
  paid: { variant: "success", icon: CircleDollarSign },
  preparing: { variant: "secondary", icon: PackageOpen },
  shipped: { variant: "default", icon: Truck },
  delivered: { variant: "success", icon: PackageCheck },
  cancelled: { variant: "destructive", icon: XCircle },
  refunded: { variant: "muted", icon: RotateCcw },
};

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { variant, icon: Icon } = STATUS_PRESENTATION[status];
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="size-3" aria-hidden />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

const FILTERS: Array<{ value: OrderStatus | "todos"; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "paid", label: "Pagados" },
  { value: "preparing", label: "Preparando" },
  { value: "shipped", label: "Enviados" },
  { value: "delivered", label: "Entregados" },
  { value: "cancelled", label: "Cancelados" },
];

const ART_FMT = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

function isStatus(v: string | undefined): v is OrderStatus {
  return v != null && Object.prototype.hasOwnProperty.call(STATUS_LABELS, v);
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const estado = sp.estado;

  const orders = await prisma.order.findMany({
    where: {
      ...(isStatus(estado) ? { status: estado } : {}),
      ...(q
        ? {
            OR: [
              { orderNumber: { contains: q, mode: "insensitive" as const } },
              { contactName: { contains: q, mode: "insensitive" as const } },
              { contactEmail: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      orderNumber: true,
      contactName: true,
      total: true,
      status: true,
      createdAt: true,
      payments: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return (
    <div className="stagger space-y-6">
      <PageHeader
        icon={ShoppingCart}
        title="Pedidos"
        subtitle="Mirá los pedidos, cambiá su estado y cargá el seguimiento del envío."
      />

      {/* Filtros y búsqueda en una tarjeta */}
      <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <SlidersHorizontal className="size-4 text-primary" aria-hidden />
          Filtrar y buscar
        </div>

        <form className="relative" action="/admin/pedidos" method="get">
          {estado && estado !== "todos" ? (
            <input type="hidden" name="estado" value={estado} />
          ) : null}
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por número, nombre o email"
            className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
            aria-label="Buscar pedidos"
          />
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = (estado ?? "todos") === f.value;
            const href =
              f.value === "todos" ? "/admin/pedidos" : `/admin/pedidos?estado=${f.value}`;
            return (
              <Link
                key={f.value}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 items-center rounded-xl border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  active
                    ? "border-transparent bg-primary-hover text-primary-foreground shadow-soft"
                    : "border-border bg-background text-foreground hover:bg-muted",
                )}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
          <span className="icon-medallion mx-auto grid size-14 place-items-center rounded-2xl" aria-hidden>
            <ShoppingCart className="size-7" />
          </span>
          <p className="mt-4 font-display text-lg font-semibold">Todavía no hay pedidos para mostrar</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando entre un pedido va a aparecer acá. Probá quitar el filtro o la búsqueda.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-surface-alt/60 hover:bg-surface-alt/60">
              <TableHead>Número</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <Link
                    href={`/admin/pedidos/${o.id}`}
                    className="font-semibold text-primary-hover tabular-nums hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {o.orderNumber}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {ART_FMT.format(o.createdAt)}
                </TableCell>
                <TableCell>{o.contactName}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatARS(toNumber(o.total))}
                </TableCell>
                <TableCell>
                  <OrderStatusBadge status={o.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
