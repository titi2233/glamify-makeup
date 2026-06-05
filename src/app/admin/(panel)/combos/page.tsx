import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/catalog/pricing";
import { formatARS } from "@/lib/money";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function CombosPage() {
  const combos = await prisma.combo.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      comboPrice: true,
      active: true,
      validFrom: true,
      validTo: true,
      _count: { select: { items: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Combos" subtitle="Packs de varios productos a un precio fijo." />
        <Button asChild>
          <Link href="/admin/combos/nuevo">
            <Plus className="size-4" aria-hidden />
            Nuevo combo
          </Link>
        </Button>
      </div>

      {combos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-lg font-semibold text-foreground">Todavía no hay combos</p>
          <p className="mt-1 text-muted-foreground">Armá un pack de productos y poné un precio especial para vender más.</p>
          <Button asChild className="mt-4">
            <Link href="/admin/combos/nuevo">
              <Plus className="size-4" aria-hidden />
              Crear el primer combo
            </Link>
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Productos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Vigencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {combos.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link href={`/admin/combos/${c.id}`} className="font-medium text-foreground hover:text-primary">
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell>{formatARS(toNumber(c.comboPrice))}</TableCell>
                <TableCell>{c._count.items}</TableCell>
                <TableCell>
                  <Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Activo" : "Inactivo"}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {c.validFrom || c.validTo
                    ? `${c.validFrom ? c.validFrom.toLocaleDateString("es-AR") : "—"} → ${c.validTo ? c.validTo.toLocaleDateString("es-AR") : "—"}`
                    : "Sin límite"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
