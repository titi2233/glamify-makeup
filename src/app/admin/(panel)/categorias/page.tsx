import Link from "next/link";
import {
  Plus,
  FolderTree,
  CircleCheck,
  EyeOff,
  CornerDownRight,
  Folder,
  MenuSquare,
} from "lucide-react";
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
  showInMenu: boolean;
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
      showInMenu: true,
      parentId: true,
      _count: { select: { products: true, productLinks: true, children: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    skuPrefix: r.skuPrefix,
    order: r.order,
    active: r.active,
    showInMenu: r.showInMenu,
    parentId: r.parentId,
    // Primaria + adicional (un producto nunca cuenta las dos veces: la validación excluye la
    // primaria de las adicionales), para que el conteo refleje también los productos que llegan
    // vía categoría adicional (ej. "Lip Combos").
    productCount: r._count.products + r._count.productLinks,
    childCount: r._count.children,
  }));
}

export default async function CategoriasPage() {
  const all = await loadCategories();
  const roots = all.filter((c) => c.parentId === null);
  const childrenOf = (id: string) => all.filter((c) => c.parentId === id);

  return (
    <div className="stagger space-y-6">
      <PageHeader
        icon={FolderTree}
        title="Categorías"
        subtitle="Organizá tus productos en categorías y subcategorías (hasta dos niveles)."
        action={
          <Button asChild>
            <Link href="/admin/categorias/nuevo">
              <Plus className="size-4" aria-hidden /> Nueva categoría
            </Link>
          </Button>
        }
      />

      {all.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
          <span className="icon-medallion mx-auto grid size-14 place-items-center rounded-2xl" aria-hidden>
            <FolderTree className="size-7" />
          </span>
          <p className="mt-4 font-display text-lg font-semibold">Todavía no hay categorías</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Creá tu primera categoría (por ejemplo, &ldquo;Labiales&rdquo;) para empezar a cargar productos.
          </p>
          <Button asChild className="mt-5">
            <Link href="/admin/categorias/nuevo">
              <Plus className="size-4" aria-hidden /> Crear la primera
            </Link>
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-surface-alt/60 hover:bg-surface-alt/60">
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
                  <TableCell>
                    <span className="flex items-center gap-2.5">
                      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden>
                        <Folder className="size-[18px]" />
                      </span>
                      <span className="font-semibold text-foreground">{root.name}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground">
                      {root.skuPrefix}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{root.productCount}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {root.active ? (
                        <Badge variant="success" className="gap-1">
                          <CircleCheck className="size-3" aria-hidden /> Activa
                        </Badge>
                      ) : (
                        <Badge variant="muted" className="gap-1">
                          <EyeOff className="size-3" aria-hidden /> Inactiva
                        </Badge>
                      )}
                      {!root.showInMenu && (
                        <Badge variant="outline" className="gap-1">
                          <MenuSquare className="size-3" aria-hidden /> Oculta del menú
                        </Badge>
                      )}
                    </span>
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
                  <TableCell>
                    <span className="flex items-center gap-2.5 pl-6 text-muted-foreground">
                      <CornerDownRight className="size-4 shrink-0 text-secondary-foreground/50" aria-hidden />
                      <span className="font-medium text-foreground">{child.name}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground">
                      {child.skuPrefix}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{child.productCount}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {child.active ? (
                        <Badge variant="success" className="gap-1">
                          <CircleCheck className="size-3" aria-hidden /> Activa
                        </Badge>
                      ) : (
                        <Badge variant="muted" className="gap-1">
                          <EyeOff className="size-3" aria-hidden /> Inactiva
                        </Badge>
                      )}
                      {!child.showInMenu && (
                        <Badge variant="outline" className="gap-1">
                          <MenuSquare className="size-3" aria-hidden /> Oculta del menú
                        </Badge>
                      )}
                    </span>
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
