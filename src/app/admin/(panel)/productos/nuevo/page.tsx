import { Package } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/page-header";
import { ProductForm, type CategoryOption } from "@/app/admin/(panel)/productos/product-form";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/admin/products/images";

function publicBase(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${url}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`;
}

export default async function NuevoProductoPage() {
  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  const options: CategoryOption[] = categories.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="stagger space-y-6">
      <PageHeader
        icon={Package}
        title="Nuevo producto"
        subtitle="Cargá un producto con sus variantes, stock y fotos."
      />
      <ProductForm categories={options} publicBase={publicBase()} />
    </div>
  );
}
