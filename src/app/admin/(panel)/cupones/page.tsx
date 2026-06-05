import Link from "next/link";
import { Plus, Ticket } from "lucide-react";
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
    <div className="space-y-6">
      <PageHeader
        title="Cupones"
        subtitle="Crea y administra los códigos de descuento para tus clientas."
        action={
          <Button asChild>
            <Link href="/admin/cupones/nuevo">
              <Plus className="size-4" />
              Nuevo cupón
            </Link>
          </Button>
        }
      />

      {coupons.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center">
          <Ticket className="size-8 text-muted-foreground" />
          <p className="font-display text-lg">Todavía no tenés cupones</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Un cupón es un código que tus clientas escriben al pagar para llevarse un descuento o el envío gratis.
          </p>
          <Button asChild>
            <Link href="/admin/cupones/nuevo">
              <Plus className="size-4" />
              Crear el primero
            </Link>
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Tipo / Valor</TableHead>
              <TableHead>Vigencia</TableHead>
              <TableHead>Usos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coupons.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-semibold">{c.code}</TableCell>
                <TableCell>
                  <span className="text-muted-foreground">{TYPE_LABEL[c.type]}</span>{" "}
                  <span className="font-medium">{valueLabel(c.type, toNumber(c.value))}</span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {dateLabel(c.validFrom)} → {dateLabel(c.validTo)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {c.usedCount}
                  {c.maxUses != null ? ` / ${c.maxUses}` : ""}
                </TableCell>
                <TableCell>
                  <Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Activo" : "Inactivo"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/admin/cupones/${c.id}`}>Editar</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
