import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, resolveCategoryPath } from "@/lib/catalog/queries";
import { buildBreadcrumbs, type CategoryNode } from "@/lib/catalog/categories";
import { getEffectivePrice, isOnSale, getDiscountPercent, toNumber } from "@/lib/catalog/pricing";
import { CatalogBreadcrumbs } from "@/components/catalog/catalog-breadcrumbs";
import { ProductGallery } from "@/components/catalog/product-gallery";
import { PriceTag } from "@/components/catalog/price-tag";
import { VariantSwatchSelector } from "@/components/catalog/variant-swatch-selector";
import { QuantityStepper } from "@/components/catalog/quantity-stepper";
import { Button } from "@/components/ui/button";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Producto — Glamify Makeup" };
  return {
    title: product.seoTitle ?? `${product.name} — Glamify Makeup`,
    description: product.seoDescription ?? product.description ?? undefined,
  };
}

export default async function ProductoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const price = getEffectivePrice(product);
  const onSale = isOnSale(product);

  // Ubicar la categoría del producto en el árbol para los breadcrumbs.
  const { tree } = await resolveCategoryPath();
  let category: CategoryNode | null = null;
  let subcategory: CategoryNode | undefined;
  for (const top of tree) {
    if (top.id === product.categoryId) {
      category = top;
      break;
    }
    const child = top.children.find((c) => c.id === product.categoryId);
    if (child) {
      category = top;
      subcategory = child;
      break;
    }
  }
  const crumbs = buildBreadcrumbs({ category, subcategory, product: { name: product.name, slug: product.slug } });

  return (
    <article className="space-y-6">
      <CatalogBreadcrumbs items={crumbs} />
      <div className="grid gap-8 lg:grid-cols-2">
        <ProductGallery images={product.images} name={product.name} />
        <div className="space-y-5">
          <header className="space-y-1">
            <p className="text-sm text-muted-foreground">{product.category.name}</p>
            <h1 className="font-display text-2xl font-bold md:text-3xl">{product.name}</h1>
          </header>

          <PriceTag
            price={price}
            compareAtPrice={onSale ? toNumber(product.compareAtPrice) : null}
            discountPercent={getDiscountPercent(product)}
            size="lg"
          />

          {product.variants.length > 0 && <VariantSwatchSelector variants={product.variants} />}

          <div className="flex flex-wrap items-center gap-3">
            <QuantityStepper max={99} />
            <Button size="lg" className="flex-1" disabled title="Disponible próximamente">
              Agregar al carrito
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">El carrito estará disponible muy pronto.</p>

          {product.description && (
            <section className="border-t border-border pt-5">
              <h2 className="mb-2 font-display text-lg">Descripción</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>
            </section>
          )}
        </div>
      </div>
    </article>
  );
}
