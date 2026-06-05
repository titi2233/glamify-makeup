import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  skuPrefix: string;
  order: number;
  active: boolean;
  parentId: string | null;
  productCount: number;
  childCount: number;
}

async function loadCategories(): Promise<CategoryNode[]> {
  const rows = await prisma.category.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      skuPrefix: true,
      order: true,
      active: true,
      parentId: true,
      _count: { select: { products: true, children: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    skuPrefix: r.skuPrefix,
    order: r.order,
    active: r.active,
    parentId: r.parentId,
    productCount: r._count.products,
    childCount: r._count.children,
  }));
}

export default async function CategoriasPage() {
  const all = await loadCategories();
  const roots = all.filter((c) => c.parentId === null);
  const childrenOf = (id: string) => all.filter((c) => c.parentId === id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categorías"
        subtitle="Organizá tus productos en categorías y subcategorías (hasta dos niveles)."
        action={
          <Button asChild>
            <Link href="/admin/categorias/nuevo">
              <Plus className="size-4" /> Nueva categoría
            </Link>
          </Button>
        }
      />

      {all.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="font-display text-lg">Todavía no hay categorías</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Creá tu primera categoría (por ejemplo, &ldquo;Labiales&rdquo;) para empezar a cargar productos.
          </p>
          <Button asChild className="mt-4">
            <Link href="/admin/categorias/nuevo">
              <Plus className="size-4" /> Crear la primera
            </Link>
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Prefijo</TableHead>
              <TableHead className="text-right">Productos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roots.flatMap((root) => {
              const kids = childrenOf(root.id);
              const rootRow = (
                <TableRow key={root.id}>
                  <TableCell className="font-medium">{root.name}</TableCell>
                  <TableCell className="font-mono text-xs">{root.skuPrefix}</TableCell>
                  <TableCell className="text-right tabular-nums">{root.productCount}</TableCell>
                  <TableCell>
                    {root.active ? <Badge>Activa</Badge> : <Badge variant="secondary">Inactiva</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/admin/categorias/${root.id}`}>Editar</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
              const childRows = kids.map((child) => (
                <TableRow key={child.id}>
                  <TableCell className="pl-8 text-muted-foreground">↳ {child.name}</TableCell>
                  <TableCell className="font-mono text-xs">{child.skuPrefix}</TableCell>
                  <TableCell className="text-right tabular-nums">{child.productCount}</TableCell>
                  <TableCell>
                    {child.active ? <Badge>Activa</Badge> : <Badge variant="secondary">Inactiva</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/admin/categorias/${child.id}`}>Editar</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ));
              return [rootRow, ...childRows];
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
