import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, resolveCategoryPath } from "@/lib/catalog/queries";
import { getRelatedProducts } from "@/lib/catalog/recommendations";
import { buildBreadcrumbs, type CategoryNode } from "@/lib/catalog/categories";
import { getEffectivePrice, isOnSale, getDiscountPercent, toNumber } from "@/lib/catalog/pricing";
import { CatalogBreadcrumbs } from "@/components/catalog/catalog-breadcrumbs";
import { ProductGallery } from "@/components/catalog/product-gallery";
import { PriceTag } from "@/components/catalog/price-tag";
import { AddToCart } from "@/components/cart/add-to-cart";
import { WishlistHeart } from "@/components/catalog/wishlist-heart";
import { CrossSell } from "@/components/catalog/cross-sell";
import { isWishlisted } from "@/app/(storefront)/cuenta/favoritos/actions";
import { getApprovedReviews } from "@/lib/reviews/queries";
import { getCustomer } from "@/lib/customer/auth";
import { prisma } from "@/lib/prisma";
import { RatingStars } from "@/components/ui/rating-stars";
import { ReviewCard } from "@/components/catalog/review-card";
import { buildProductJsonLd } from "@/lib/seo/jsonld";
import { absoluteUrl } from "@/lib/seo/url";
import { TrackOnMount } from "@/components/analytics/track-on-mount";
import { ReviewForm } from "./review-form";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Producto" };
  const description = product.seoDescription ?? product.description ?? undefined;
  const image = product.images[0] ? absoluteUrl(product.images[0]) : undefined;
  return {
    title: product.seoTitle ? { absolute: product.seoTitle } : product.name,
    description,
    alternates: { canonical: absoluteUrl(`/producto/${slug}`) },
    openGraph: {
      type: "website",
      title: product.name,
      description,
      url: absoluteUrl(`/producto/${slug}`),
      images: image ? [image] : undefined,
    },
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

  // Reseñas (display) + contexto de alta (abierta + moderación).
  const [{ reviews, count, average }, related] = await Promise.all([
    getApprovedReviews(product.id),
    getRelatedProducts(product.id, product.categoryId, 4),
  ]);
  const customer = await getCustomer();
  let alreadyReviewed = false;
  if (customer) {
    const existing = await prisma.review.findUnique({
      where: { customerId_productId: { customerId: customer.id, productId: product.id } },
    });
    alreadyReviewed = Boolean(existing);
  }

  const inStock = product.variants.some((v) => v.active && v.stock > 0);
  const jsonLd = buildProductJsonLd(
    {
      name: product.name,
      description: product.seoDescription ?? product.description,
      images: product.images.map((img) => absoluteUrl(img)),
      sku: product.variants[0]?.sku ?? null,
      price,
      inStock,
      url: absoluteUrl(`/producto/${slug}`),
    },
    { average, count },
  );

  return (
    <article className="space-y-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <TrackOnMount event="product_viewed" props={{ productId: product.id, slug: product.slug, name: product.name }} />
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

        {customer && alreadyReviewed ? (
          <p className="text-sm text-muted-foreground">Ya dejaste tu reseña. ¡Gracias!</p>
        ) : (
          <ReviewForm productId={product.id} slug={product.slug} isLoggedIn={Boolean(customer)} />
        )}

        <div className="mt-4 space-y-3">
          {reviews.length === 0
            ? <p className="text-sm text-muted-foreground">Todavía no hay reseñas. ¡Sé la primera!</p>
            : reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
        </div>
      </section>

      <CrossSell products={related} />
    </article>
  );
}
