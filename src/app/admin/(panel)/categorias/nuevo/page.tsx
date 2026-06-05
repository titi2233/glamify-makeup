import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/page-header";
import { CategoryForm, type ParentOption } from "@/app/admin/(panel)/categorias/category-form";

export const dynamic = "force-dynamic";

async function loadRootParents(): Promise<ParentOption[]> {
  const rows = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  return rows;
}

export default async function NuevaCategoriaPage() {
  const parents = await loadRootParents();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Nueva categoría"
        subtitle="Cargá una categoría nueva. Si elegís una categoría padre, será una subcategoría."
      />
      <CategoryForm parents={parents} />
    </div>
  );
}
