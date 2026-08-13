import { notFound } from "next/navigation";
import { Package } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/catalog/pricing";
import { PageHeader } from "@/components/admin/page-header";
import { ProductForm, type CategoryOption } from "@/app/admin/(panel)/productos/product-form";
import { productImagesPublicBase } from "@/lib/images";
import type { ProductFormInput } from "@/lib/admin/products/validation";

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
      id: v.id,
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
    <div className="stagger space-y-6">
      <PageHeader
        icon={Package}
        title={`Editar: ${product.name}`}
        subtitle="Cambiá datos, precios, stock o variantes."
      />
      <ProductForm categories={options} publicBase={productImagesPublicBase()} productId={product.id} initial={initial} />
    </div>
  );
}
