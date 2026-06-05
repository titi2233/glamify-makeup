import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatARS } from "@/lib/money";
import { toNumber } from "@/lib/catalog/pricing";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface SearchParams {
  q?: string;
  categoria?: string;
  activo?: string;
  bajostock?: string;
}

export default async function ProductosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const categoriaId = (sp.categoria ?? "").trim();
  const activo = sp.activo ?? "";
  const lowStock = sp.bajostock === "1";

  const where: {
    deletedAt: null;
    active?: boolean;
    categoryId?: string;
    OR?: Array<{ name: { contains: string; mode: "insensitive" } } | { variants: { some: { sku: { contains: string; mode: "insensitive" } } } }>;
  } = { deletedAt: null };
  if (activo === "1") where.active = true;
  if (activo === "0") where.active = false;
  if (categoriaId) where.categoryId = categoriaId;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: { category: { select: { name: true } }, variants: { select: { stock: true, lowStockThreshold: true, sku: true } } },
      take: 200,
    }),
    prisma.category.findMany({ where: { active: true }, orderBy: [{ order: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);

  const rows = products
    .map((p) => {
      const totalStock = p.variants.reduce((acc, v) => acc + v.stock, 0);
      const isLow = p.variants.some((v) => v.stock <= v.lowStockThreshold);
      const firstSku = p.variants[0]?.sku ?? "—";
      return { p, totalStock, isLow, firstSku };
    })
    .filter((r) => (lowStock ? r.isLow : true));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Productos"
        subtitle="Acá ves, creás y editás todo lo que vendés."
        action={
          <Button asChild>
            <Link href="/admin/productos/nuevo">
              <Plus className="size-4" aria-hidden /> Nuevo producto
            </Link>
          </Button>
        }
      />

      <form className="flex flex-wrap items-end gap-3" action="/admin/productos" method="get">
        <div className="relative grow">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre o SKU"
            aria-label="Buscar producto"
            className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-base md:text-sm"
          />
        </div>
        <select name="categoria" defaultValue={categoriaId} aria-label="Categoría" className="h-11 rounded-xl border border-border bg-background px-3 text-sm">
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="activo" defaultValue={activo} aria-label="Estado" className="h-11 rounded-xl border border-border bg-background px-3 text-sm">
          <option value="">Activos e inactivos</option>
          <option value="1">Solo activos</option>
          <option value="0">Solo inactivos</option>
        </select>
        <label className="flex h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm">
          <input type="checkbox" name="bajostock" value="1" defaultChecked={lowStock} /> Bajo stock
        </label>
        <Button type="submit" variant="outline">Filtrar</Button>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="font-display text-lg">Todavía no hay productos para mostrar</p>
          <p className="mt-1 text-sm text-muted-foreground">Creá tu primer producto para empezar a vender.</p>
          <Button asChild className="mt-4">
            <Link href="/admin/productos/nuevo">
              <Plus className="size-4" aria-hidden /> Nuevo producto
            </Link>
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ p, totalStock, isLow, firstSku }) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link href={`/admin/productos/${p.id}`} className="font-semibold text-primary hover:underline">
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.category.name}</TableCell>
                <TableCell className="tabular-nums">{firstSku}</TableCell>
                <TableCell className="text-right tabular-nums">{formatARS(toNumber(p.basePrice))}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {totalStock}{isLow && <Badge variant="destructive" className="ml-2">Bajo</Badge>}
                </TableCell>
                <TableCell>
                  {p.active ? <Badge variant="secondary">Activo</Badge> : <Badge variant="outline">Inactivo</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
