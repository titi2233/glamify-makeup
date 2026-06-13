import { notFound } from "next/navigation";
import { FolderPen } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/page-header";
import {
  CategoryForm,
  type ParentOption,
  type CategoryFormValues,
} from "@/app/admin/(panel)/categorias/category-form";

export const dynamic = "force-dynamic";

export default async function EditarCategoriaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const category = await prisma.category.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      skuPrefix: true,
      order: true,
      active: true,
      image: true,
    },
  });
  if (!category) notFound();

  // Posibles padres: solo categorías raíz, excluyendo la propia (no puede ser su padre).
  const parentRows = await prisma.category.findMany({
    where: { parentId: null, id: { not: id } },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  const parents: ParentOption[] = parentRows;

  const initial: CategoryFormValues = {
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentId: category.parentId,
    skuPrefix: category.skuPrefix,
    order: category.order,
    active: category.active,
    image: category.image,
  };

  return (
    <div className="stagger space-y-6">
      <PageHeader
        icon={FolderPen}
        title={`Editar: ${category.name}`}
        subtitle="Cambiá los datos de la categoría. El slug afecta la dirección en la web."
      />
      <CategoryForm initial={initial} parents={parents} />
    </div>
  );
}
