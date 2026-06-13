import Link from "next/link";
import { Plus, Search, Package, AlertTriangle, CircleCheck, EyeOff, SlidersHorizontal } from "lucide-react";
import { Prisma } from "@prisma/client";
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
    id?: { in: string[] };
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

  // El bajo stock es `stock <= lowStockThreshold` (dos columnas de la misma fila),
  // algo que el `where` de Prisma no puede comparar. Resolvemos los ids de productos
  // con al menos una variante en bajo stock vía SQL y los metemos en el `where`, así
  // el filtro abarca TODO el catálogo (no solo los primeros 200) — issue del review.
  if (lowStock) {
    const lowStockRows = await prisma.$queryRaw<Array<{ productId: string }>>(Prisma.sql`
      SELECT DISTINCT v."productId" AS "productId"
      FROM "ProductVariant" v
      JOIN "Product" p ON p."id" = v."productId"
      WHERE p."deletedAt" IS NULL AND v."stock" <= v."lowStockThreshold"
    `);
    where.id = { in: lowStockRows.map((r) => r.productId) };
  }

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: { category: { select: { name: true } }, variants: { select: { stock: true, lowStockThreshold: true, sku: true } } },
      // Sin tope cuando filtramos por bajo stock: el `where.id` ya acota el set y
      // truncar acá volvería a esconder productos críticos del fondo del catálogo.
      ...(lowStock ? {} : { take: 200 }),
    }),
    prisma.category.findMany({ where: { active: true }, orderBy: [{ order: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);

  const rows = products.map((p) => {
    const totalStock = p.variants.reduce((acc, v) => acc + v.stock, 0);
    const isLow = p.variants.some((v) => v.stock <= v.lowStockThreshold);
    const firstSku = p.variants[0]?.sku ?? "—";
    return { p, totalStock, isLow, firstSku };
  });

  const inputClass =
    "h-11 w-full rounded-xl border border-input bg-background px-3 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm";

  return (
    <div className="stagger space-y-6">
      <PageHeader
        icon={Package}
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

      {/* Filtros en una tarjeta */}
      <form
        className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft"
        action="/admin/productos"
        method="get"
      >
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <SlidersHorizontal className="size-4 text-primary" aria-hidden />
          Filtrar y buscar
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[12rem] grow">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input name="q" defaultValue={q} placeholder="Buscar por nombre o SKU" aria-label="Buscar producto" className={`${inputClass} pl-9`} />
          </div>
          <select name="categoria" defaultValue={categoriaId} aria-label="Categoría" className="h-11 rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">Todas las categorías</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select name="activo" defaultValue={activo} aria-label="Estado" className="h-11 rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">Activos e inactivos</option>
            <option value="1">Solo activos</option>
            <option value="0">Solo inactivos</option>
          </select>
          <label className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-input bg-background px-3 text-sm">
            <input type="checkbox" name="bajostock" value="1" defaultChecked={lowStock} className="size-4 accent-primary" /> Bajo stock
          </label>
          <Button type="submit" variant="outline">Filtrar</Button>
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
          <span className="icon-medallion mx-auto grid size-14 place-items-center rounded-2xl" aria-hidden>
            <Package className="size-7" />
          </span>
          <p className="mt-4 font-display text-lg font-semibold">Todavía no hay productos para mostrar</p>
          <p className="mt-1 text-sm text-muted-foreground">Creá tu primer producto para empezar a vender.</p>
          <Button asChild className="mt-5">
            <Link href="/admin/productos/nuevo">
              <Plus className="size-4" aria-hidden /> Nuevo producto
            </Link>
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-surface-alt/60 hover:bg-surface-alt/60">
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
                  <Link href={`/admin/productos/${p.id}`} className="font-semibold text-primary-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.category.name}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{firstSku}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatARS(toNumber(p.basePrice))}</TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className="inline-flex items-center gap-2">
                    {totalStock}
                    {isLow && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="size-3" aria-hidden /> Bajo
                      </Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  {p.active ? (
                    <Badge variant="success" className="gap-1">
                      <CircleCheck className="size-3" aria-hidden /> Activo
                    </Badge>
                  ) : (
                    <Badge variant="muted" className="gap-1">
                      <EyeOff className="size-3" aria-hidden /> Inactivo
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
