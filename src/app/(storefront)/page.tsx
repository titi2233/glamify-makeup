import Link from "next/link";
import { ProductGrid } from "@/components/catalog/product-grid";
import { ProductImage } from "@/components/catalog/product-image";
import { ValueProps } from "@/components/marketing/value-props";
import { GlamifyWelcomeBanner } from "@/components/marketing/glamify-welcome-banner";
import { GiftSection } from "@/components/marketing/gift-section";
import { getCategoryTree, getFeaturedProducts, getNewestProducts } from "@/lib/catalog/queries";
import { buildWebSiteJsonLd, buildOrganizationJsonLd, serializeJsonLd } from "@/lib/seo/jsonld";
import { appBaseUrl } from "@/lib/seo/url";
import { ArrowRight } from "lucide-react";

export default async function HomePage() {
  const [tree, featuredRaw] = await Promise.all([getCategoryTree(), getFeaturedProducts(8)]);
  const featured = featuredRaw.length > 0 ? featuredRaw : await getNewestProducts(8);
  const base = appBaseUrl();
  const jsonLd = [buildWebSiteJsonLd(base), buildOrganizationJsonLd(base)];

  return (
    <div className="space-y-16 pb-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

      {/* Banner Editorial Glamify con botones de acción */}
      <GlamifyWelcomeBanner />

      {/* Sección Especial Regalos: Regalá beauty, regalá Glamify */}
      <GiftSection />

      {/* Propuestas de Valor / Pilares de Confianza */}
      <ValueProps />

      {/* Categorías Destacadas */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-border/60 pb-3">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-wider text-foreground">
              Comprar por Categoría
            </h2>
            <p className="text-sm text-muted-foreground">Encontrá el producto ideal según tu rutina</p>
          </div>
          <Link
            href="/tienda"
            className="text-xs font-bold uppercase tracking-widest text-primary hover:underline inline-flex items-center gap-1"
          >
            <span>Ver todo el catálogo</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {tree.map((cat) => (
            <li key={cat.id}>
              <Link
                href={`/tienda/${cat.slug}`}
                className="group block overflow-hidden rounded-2xl border border-border/80 bg-white shadow-soft transition-all duration-300 hover:shadow-soft-lg hover:border-neutral-300/80 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="overflow-hidden aspect-square bg-secondary">
                  <ProductImage src={cat.image} alt={cat.name} fallbackLabel={cat.name} className="rounded-none h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-3.5 bg-white text-center border-t border-border/40">
                  <span className="block text-sm font-semibold tracking-wide uppercase text-foreground group-hover:text-primary transition-colors">
                    {cat.name}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Héroes de catálogo / Destacados */}
      {featured.length > 0 && (
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-border/60 pb-3">
            <div>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-wider text-foreground">
                Los Más Elegidos
              </h2>
              <p className="text-sm text-muted-foreground">Favoritos virales de nuestra comunidad</p>
            </div>
            <Link
              href="/tienda"
              className="text-xs font-bold uppercase tracking-widest text-primary hover:underline inline-flex items-center gap-1"
            >
              <span>Ver todos</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <ProductGrid products={featured} />
        </section>
      )}
    </div>
  );
}
