import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, resolveCategoryPath } from "@/lib/catalog/queries";
import { buildBreadcrumbs, type CategoryNode } from "@/lib/catalog/categories";
import { getEffectivePrice, isOnSale, getDiscountPercent, toNumber } from "@/lib/catalog/pricing";
import { CatalogBreadcrumbs } from "@/components/catalog/catalog-breadcrumbs";
import { ProductGallery } from "@/components/catalog/product-gallery";
import { PriceTag } from "@/components/catalog/price-tag";
import { AddToCart } from "@/components/cart/add-to-cart";
import { WishlistHeart } from "@/components/catalog/wishlist-heart";
import { isWishlisted } from "@/app/(storefront)/cuenta/favoritos/actions";
import { getApprovedReviews } from "@/lib/reviews/queries";
import { hasPurchased } from "@/lib/reviews/purchase";
import { getCustomer } from "@/lib/customer/auth";
import { prisma } from "@/lib/prisma";
import { RatingStars } from "@/components/ui/rating-stars";
import { ReviewCard } from "@/components/catalog/review-card";
import { ReviewForm } from "./review-form";

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
  const wishlisted = await isWishlisted(product.id);

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

  // Reseñas (display + contexto de alta con compra verificada).
  const { reviews, count, average } = await getApprovedReviews(product.id);
  const customer = await getCustomer();
  let canReview = false;
  let alreadyReviewed = false;
  if (customer) {
    const [purchasedRows, existing] = await Promise.all([
      prisma.orderItem.findMany({
        where: {
          order: { customerId: customer.id, status: { in: ["paid", "preparing", "shipped", "delivered"] } },
          variant: { productId: product.id },
        },
        select: { variant: { select: { productId: true } } },
      }),
      prisma.review.findUnique({ where: { customerId_productId: { customerId: customer.id, productId: product.id } } }),
    ]);
    canReview = hasPurchased(purchasedRows.map((r) => ({ productId: r.variant?.productId ?? "" })), product.id);
    alreadyReviewed = Boolean(existing);
  }

  return (
    <article className="space-y-6">
      <CatalogBreadcrumbs items={crumbs} />
      <div className="grid gap-8 lg:grid-cols-2">
        <ProductGallery images={product.images} name={product.name} />
        <div className="space-y-5">
          <header className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{product.category.name}</p>
              <h1 className="font-display text-2xl font-bold md:text-3xl">{product.name}</h1>
            </div>
            <WishlistHeart productId={product.id} initial={wishlisted} />
          </header>

          <PriceTag
            price={price}
            compareAtPrice={onSale ? toNumber(product.compareAtPrice) : null}
            discountPercent={getDiscountPercent(product)}
            size="lg"
          />

          <AddToCart variants={product.variants} />

          {product.description && (
            <section className="border-t border-border pt-5">
              <h2 className="mb-2 font-display text-lg">Descripción</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>
            </section>
          )}
        </div>
      </div>

      <section className="border-t border-border pt-6">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-display text-lg">Reseñas</h2>
          {count > 0 && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <RatingStars value={average} size="sm" /> {average.toFixed(1)} ({count})
            </span>
          )}
        </div>

        {!customer && (
          <p className="text-sm text-muted-foreground">
            <a href="/ingresar" className="text-primary underline">Iniciá sesión</a> para dejar tu reseña.
          </p>
        )}
        {customer && !canReview && (
          <p className="text-sm text-muted-foreground">Solo quienes compraron este producto pueden reseñarlo.</p>
        )}
        {customer && canReview && !alreadyReviewed && <ReviewForm productId={product.id} slug={product.slug} />}
        {customer && alreadyReviewed && <p className="text-sm text-muted-foreground">Ya dejaste tu reseña. ¡Gracias!</p>}

        <div className="mt-4 space-y-3">
          {reviews.length === 0
            ? <p className="text-sm text-muted-foreground">Todavía no hay reseñas. ¡Sé la primera!</p>
            : reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
        </div>
      </section>
    </article>
  );
}
