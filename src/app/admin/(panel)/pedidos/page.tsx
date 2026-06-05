import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatARS } from "@/lib/money";
import { toNumber } from "@/lib/catalog/pricing";
import { STATUS_LABELS } from "@/lib/admin/orders/service";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<OrderStatus, string> = {
  pending_payment: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  preparing: "bg-sky-100 text-sky-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-rose-100 text-rose-800",
  refunded: "bg-zinc-200 text-zinc-700",
};

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
    <div className="space-y-6">
      <PageHeader
        title="Pedidos"
        subtitle="Mirá los pedidos, cambiá su estado y cargá el seguimiento del envío."
      />

      <form className="flex flex-wrap items-center gap-2" action="/admin/pedidos" method="get">
        {estado && estado !== "todos" ? (
          <input type="hidden" name="estado" value={estado} />
        ) : null}
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por número, nombre o email"
          className="h-11 min-w-[16rem] flex-1 rounded-xl border border-border px-4 text-base"
          aria-label="Buscar pedidos"
        />
      </form>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = (estado ?? "todos") === f.value;
          const href =
            f.value === "todos" ? "/admin/pedidos" : `/admin/pedidos?estado=${f.value}`;
          return (
            <Link
              key={f.value}
              href={href}
              className={cn(
                "inline-flex h-11 items-center rounded-full border px-4 text-sm font-semibold",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-10 text-center">
          <p className="text-lg font-semibold text-foreground">
            Todavía no hay pedidos para mostrar
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando entre un pedido va a aparecer acá. Probá quitar el filtro o la búsqueda.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
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
                      className="font-semibold text-primary hover:underline"
                    >
                      {o.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {ART_FMT.format(o.createdAt)}
                  </TableCell>
                  <TableCell>{o.contactName}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatARS(toNumber(o.total))}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("font-semibold", STATUS_CHIP[o.status])}>
                      {STATUS_LABELS[o.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
