import Link from "next/link";
import { Plus, Ticket, Percent, Banknote, Truck, CircleCheck, EyeOff, Pencil, type LucideIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/catalog/pricing";
import { formatARS } from "@/lib/money";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  percentage: "Porcentaje",
  fixed: "Monto fijo",
  free_shipping: "Envío gratis",
};

const TYPE_ICON: Record<string, LucideIcon> = {
  percentage: Percent,
  fixed: Banknote,
  free_shipping: Truck,
};

function valueLabel(type: string, value: number): string {
  if (type === "percentage") return `${value}%`;
  if (type === "fixed") return formatARS(value);
  return "Envío gratis";
}

function dateLabel(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function CuponesPage() {
  const coupons = await prisma.coupon.findMany({ orderBy: { code: "asc" } });

  return (
    <div className="stagger space-y-6">
      <PageHeader
        icon={Ticket}
        title="Cupones"
        subtitle="Crea y administra los códigos de descuento para tus clientas."
        action={
          <Button asChild>
            <Link href="/admin/cupones/nuevo">
              <Plus className="size-4" aria-hidden />
              Nuevo cupón
            </Link>
          </Button>
        }
      />

      {coupons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
          <span className="icon-medallion mx-auto grid size-14 place-items-center rounded-2xl" aria-hidden>
            <Ticket className="size-7" />
          </span>
          <p className="mt-4 font-display text-lg font-semibold">Todavía no tenés cupones</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Un cupón es un código que tus clientas escriben al pagar para llevarse un descuento o el envío gratis.
          </p>
          <Button asChild className="mt-5">
            <Link href="/admin/cupones/nuevo">
              <Plus className="size-4" aria-hidden />
              Crear el primero
            </Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-alt/60 hover:bg-surface-alt/60">
                <TableHead>Código</TableHead>
                <TableHead>Tipo / Valor</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead className="text-right">Usos</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((c) => {
                const TypeIcon = TYPE_ICON[c.type] ?? Ticket;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <span className="inline-flex items-center gap-2 font-semibold tracking-wide text-foreground">
                        <Ticket className="size-4 text-primary" aria-hidden />
                        {c.code}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1">
                        <TypeIcon className="size-3" aria-hidden />
                        {TYPE_LABEL[c.type]}
                      </Badge>{" "}
                      <span className="font-semibold tabular-nums">{valueLabel(c.type, toNumber(c.value))}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">
                      {dateLabel(c.validFrom)} → {dateLabel(c.validTo)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.usedCount}
                      {c.maxUses != null ? ` / ${c.maxUses}` : ""}
                    </TableCell>
                    <TableCell>
                      {c.active ? (
                        <Badge variant="success" className="gap-1">
                          <CircleCheck className="size-3" aria-hidden /> Activo
                        </Badge>
                      ) : (
                        <Badge variant="muted" className="gap-1">
                          <EyeOff className="size-3" aria-hidden /> Inactivo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/cupones/${c.id}`}>
                          <Pencil className="size-4" aria-hidden />
                          Editar
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
