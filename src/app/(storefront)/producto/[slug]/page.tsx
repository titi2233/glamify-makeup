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
import { TrustBadges } from "@/components/catalog/trust-badges";
import { PdpAccordions } from "@/components/catalog/pdp-accordions";
import { MobileStickyBuyBar } from "@/components/catalog/mobile-sticky-buy-bar";
import { CrossSell } from "@/components/catalog/cross-sell";
import { isWishlisted } from "@/app/(storefront)/cuenta/favoritos/actions";
import { getApprovedReviews } from "@/lib/reviews/queries";
import { getCustomer } from "@/lib/customer/auth";
import { prisma } from "@/lib/prisma";
import { RatingStars } from "@/components/ui/rating-stars";
import { ReviewCard } from "@/components/catalog/review-card";
import { buildProductJsonLd, serializeJsonLd } from "@/lib/seo/jsonld";
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
    <article className="space-y-10 pb-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <TrackOnMount event="product_viewed" props={{ productId: product.id, slug: product.slug, name: product.name }} />
      
      <CatalogBreadcrumbs items={crumbs} />

      {/* 50/50 Desktop Sticky Layout */}
      <div className="grid gap-10 lg:grid-cols-12 items-start">
        <div className="lg:col-span-7">
          <ProductGallery images={product.images} name={product.name} />
        </div>

        <div className="lg:col-span-5 lg:sticky lg:top-28 space-y-6">
          <header className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">{product.category.name}</p>
              <WishlistHeart productId={product.id} initial={wishlisted} />
            </div>
            
            <h1 className="font-display text-2xl font-bold md:text-3xl text-foreground leading-tight">
              {product.name}
            </h1>

            {count > 0 && (
              <div className="flex items-center gap-1.5 pt-0.5">
                <RatingStars value={average} size="sm" />
                <span className="text-xs font-medium text-muted-foreground">
                  {average.toFixed(1)} ({count} reseñas)
                </span>
              </div>
            )}
          </header>

          <PriceTag
            price={price}
            compareAtPrice={onSale ? toNumber(product.compareAtPrice) : null}
            discountPercent={getDiscountPercent(product)}
            size="lg"
          />

          <AddToCart variants={product.variants} />

          <TrustBadges />

          <PdpAccordions description={product.description} />
        </div>
      </div>

      {/* Sección de Reseñas */}
      <section className="border-t border-border/80 pt-10">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide">Opiniones de la Comunidad</h2>
            <p className="text-xs text-muted-foreground">Experiencias reales de clientas verificadas</p>
          </div>
          {count > 0 && (
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <RatingStars value={average} size="sm" /> {average.toFixed(1)} ({count} reseñas)
            </span>
          )}
        </div>

        {customer && alreadyReviewed ? (
          <p className="text-sm text-muted-foreground bg-secondary/50 rounded-xl p-3">
            Ya dejaste tu reseña sobre este producto. ¡Muchas gracias por tu recomendación! ✨
          </p>
        ) : (
          <ReviewForm productId={product.id} slug={product.slug} isLoggedIn={Boolean(customer)} />
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.length === 0 ? (
            <p className="col-span-full text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-6 text-center">
              Todavía no hay reseñas para este producto. ¡Sé la primera en compartir tu experiencia! ✨
            </p>
          ) : (
            reviews.map((r) => <ReviewCard key={r.id} review={r} />)
          )}
        </div>
      </section>

      {/* Productos Relacionados */}
      <CrossSell products={related} />

      {/* Barra de Compra Móvil (Thumb-Zone CRO) */}
      <MobileStickyBuyBar
        productName={product.name}
        image={product.images[0]}
        price={price}
        variants={product.variants}
      />
    </article>
  );
}
