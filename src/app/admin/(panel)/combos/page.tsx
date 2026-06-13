import Link from "next/link";
import { Plus, Layers, CircleCheck, EyeOff, Package, CalendarRange, Infinity as InfinityIcon } from "lucide-react";
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
    <div className="stagger space-y-6">
      <PageHeader
        icon={Layers}
        title="Combos"
        subtitle="Armá packs de varios productos a un precio fijo para vender más."
        action={
          <Button asChild>
            <Link href="/admin/combos/nuevo">
              <Plus className="size-4" aria-hidden /> Nuevo combo
            </Link>
          </Button>
        }
      />

      {combos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
          <span className="icon-medallion mx-auto grid size-14 place-items-center rounded-2xl" aria-hidden>
            <Layers className="size-7" />
          </span>
          <p className="mt-4 font-display text-lg font-semibold">Todavía no hay combos</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Armá un pack de productos y poné un precio especial para vender más.
          </p>
          <Button asChild className="mt-5">
            <Link href="/admin/combos/nuevo">
              <Plus className="size-4" aria-hidden /> Crear el primer combo
            </Link>
          </Button>
        </div>
      ) : (
        <section className="admin-card overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft">
          <header className="flex items-center gap-2.5 border-b border-border/70 bg-surface-alt/60 px-5 py-3.5">
            <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden>
              <Layers className="size-[18px]" />
            </span>
            <h2 className="font-display text-lg font-semibold text-foreground">Tus combos</h2>
          </header>
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-alt/60 hover:bg-surface-alt/60">
                <TableHead>Nombre</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Productos</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Vigencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {combos.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/admin/combos/${c.id}`}
                      className="font-semibold text-primary-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatARS(toNumber(c.comboPrice))}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Package className="size-3.5 text-primary/70" aria-hidden />
                      {c._count.items}
                    </span>
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
                  <TableCell className="text-sm text-muted-foreground">
                    {c.validFrom || c.validTo ? (
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        <CalendarRange className="size-3.5 text-primary/70" aria-hidden />
                        {`${c.validFrom ? c.validFrom.toLocaleDateString("es-AR") : "—"} → ${c.validTo ? c.validTo.toLocaleDateString("es-AR") : "—"}`}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <InfinityIcon className="size-3.5 text-primary/70" aria-hidden />
                        Sin límite
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </div>
  );
}
