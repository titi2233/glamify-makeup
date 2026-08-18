import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductGrid } from "@/components/catalog/product-grid";
import { ProductImage } from "@/components/catalog/product-image";
import { ValueProps } from "@/components/marketing/value-props";
import { UgcReelsSection } from "@/components/marketing/ugc-reels-section";
import { getCategoryTree, getFeaturedProducts, getNewestProducts } from "@/lib/catalog/queries";
import { buildWebSiteJsonLd, buildOrganizationJsonLd, serializeJsonLd } from "@/lib/seo/jsonld";
import { appBaseUrl } from "@/lib/seo/url";
import { Sparkles, ArrowRight, Star } from "lucide-react";

export default async function HomePage() {
  const [tree, featuredRaw] = await Promise.all([getCategoryTree(), getFeaturedProducts(8)]);
  const featured = featuredRaw.length > 0 ? featuredRaw : await getNewestProducts(8);
  const base = appBaseUrl();
  const jsonLd = [buildWebSiteJsonLd(base), buildOrganizationJsonLd(base)];

  return (
    <div className="space-y-16 pb-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

      {/* Hero Editorial de Alto Impacto */}
      <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-white/95 backdrop-blur-md shadow-soft-lg grid grid-cols-1 md:grid-cols-12 gap-8 items-center p-8 md:p-12 lg:p-16">
        <div className="md:col-span-7 text-center md:text-left space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-secondary text-primary text-xs font-bold uppercase tracking-widest border border-primary/20">
            <Sparkles className="size-3.5" />
            <span>Colección 2026 · Clean Beauty</span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.08] tracking-tight">
            Maquillaje que cuida y resalta tu piel real
          </h1>

          <p className="max-w-xl text-base md:text-lg text-muted-foreground leading-relaxed mx-auto md:mx-0">
            Fórmulas dermatológicamente testeadas, tonos en tendencia y acabado natural de larga duración. Glamour accesible, sin comprometer tu piel.
          </p>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
            <Button asChild size="lg" className="bg-[#161413] text-white hover:bg-neutral-800 rounded-2xl px-8 py-6 text-sm font-semibold shadow-soft hover:shadow-soft-lg transition-all">
              <Link href="/tienda" className="flex items-center gap-2">
                <span>Explorar Catálogo</span>
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-2xl px-6 py-6 text-sm font-semibold border-border/80 hover:bg-secondary">
              <Link href="/tienda?filter=offers">Ver Novedades & Ofertas</Link>
            </Button>
          </div>

          {/* Micro Social Proof Badge */}
          <div className="flex items-center justify-center md:justify-start gap-3 pt-4 border-t border-border/60">
            <div className="flex text-amber-500">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              <strong className="text-foreground font-bold">4.9 / 5.0</strong> en más de 2.500 reseñas verificadas
            </span>
          </div>
        </div>

        <div className="md:col-span-5 relative aspect-[4/3] md:aspect-square w-full overflow-hidden rounded-2xl border border-border/60 shadow-soft bg-secondary">
          <img
            src="/images/hero_editorial_glow.jpg"
            alt="Glamify Makeup - Colección de Belleza Editorial"
            className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
          />
        </div>
      </section>

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

      {/* Sección UGC / Social Proof */}
      <UgcReelsSection />
    </div>
  );
}
