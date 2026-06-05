import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/catalog/pricing";
import { PageHeader } from "@/components/admin/page-header";
import { ProductForm, type CategoryOption } from "@/app/admin/(panel)/productos/product-form";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/admin/products/images";
import type { ProductFormInput } from "@/lib/admin/products/validation";

function publicBase(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${url}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`;
}

export default async function EditarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: { variants: { orderBy: { order: "asc" } } },
    }),
    prisma.category.findMany({
      where: { active: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);
  if (!product) notFound();

  const options: CategoryOption[] = categories.map((c) => ({ id: c.id, name: c.name }));

  const initial: ProductFormInput = {
    name: product.name,
    slug: product.slug,
    description: product.description,
    categoryId: product.categoryId,
    basePrice: toNumber(product.basePrice),
    compareAtPrice: product.compareAtPrice != null ? toNumber(product.compareAtPrice) : null,
    cost: toNumber(product.cost),
    weightGr: product.weightGr,
    images: product.images,
    isFeatured: product.isFeatured,
    heroRank: product.heroRank,
    tags: product.tags,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    active: product.active,
    variants: product.variants.map((v) => ({
      name: v.name,
      swatchHex: v.swatchHex,
      sku: v.sku,
      stock: v.stock,
      lowStockThreshold: v.lowStockThreshold,
      priceOverride: v.priceOverride != null ? toNumber(v.priceOverride) : null,
      weightGrOverride: v.weightGrOverride,
      image: v.image,
      active: v.active,
      order: v.order,
    })),
  };

  return (
    <div className="space-y-6">
      <PageHeader title={`Editar: ${product.name}`} subtitle="Cambiá datos, precios, stock o variantes." />
      <ProductForm categories={options} publicBase={publicBase()} productId={product.id} initial={initial} />
    </div>
  );
}
