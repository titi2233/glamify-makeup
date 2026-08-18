import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductGrid } from "@/components/catalog/product-grid";
import { ProductImage } from "@/components/catalog/product-image";
import { getCategoryTree, getFeaturedProducts, getNewestProducts } from "@/lib/catalog/queries";
import { buildWebSiteJsonLd, buildOrganizationJsonLd, serializeJsonLd } from "@/lib/seo/jsonld";
import { appBaseUrl } from "@/lib/seo/url";
import { Sparkles, ArrowRight } from "lucide-react";

export default async function HomePage() {
  const [tree, featuredRaw] = await Promise.all([getCategoryTree(), getFeaturedProducts(8)]);
  const featured = featuredRaw.length > 0 ? featuredRaw : await getNewestProducts(8);
  const base = appBaseUrl();
  const jsonLd = [buildWebSiteJsonLd(base), buildOrganizationJsonLd(base)];

  return (
    <div className="space-y-16 pb-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

      {/* Hero Editorial */}
      <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-white/95 backdrop-blur-md shadow-soft-lg grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-center p-8 md:p-12 lg:p-16">
        <div className="text-center md:text-left space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-secondary/80 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest">
            <Sparkles className="size-3.5" />
            <span>Glamour Accesible · Calidad Real</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight">
            Maquillaje que resalta tu belleza
          </h1>
          <p className="max-w-md text-base text-muted-foreground leading-relaxed mx-auto md:mx-0">
            Fórmulas de larga duración, tonos en tendencia y accesorios esenciales para tu día a día, a precio real.
          </p>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
            <Button asChild size="lg" className="bg-neutral-900 text-white hover:bg-neutral-800 rounded-xl px-8 shadow-md">
              <Link href="/tienda" className="flex items-center gap-2">
                <span>Ver Tienda</span>
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border/60 shadow-soft">
          <img
            src="/images/hero_banner.png"
            alt="Glamify Makeup - Maquillaje y accesorios"
            className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
          />
        </div>
      </section>

      {/* Categorías Destacadas */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-border/60 pb-3">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-wider text-foreground">
              Categorías
            </h2>
            <p className="text-sm text-muted-foreground">Explorá los productos por zona</p>
          </div>
          <Link
            href="/tienda"
            className="text-xs font-bold uppercase tracking-widest text-primary hover:underline inline-flex items-center gap-1"
          >
            <span>Ver todo el catálogo</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {tree.map((cat) => (
            <li key={cat.id}>
              <Link
                href={`/tienda/${cat.slug}`}
                className="group block overflow-hidden rounded-2xl border border-border/80 bg-white shadow-soft transition-all duration-300 hover:shadow-soft-lg hover:border-neutral-300/80 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="overflow-hidden">
                  <ProductImage src={cat.image} alt={cat.name} fallbackLabel={cat.name} className="rounded-none" />
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
                Destacados
              </h2>
              <p className="text-sm text-muted-foreground">Los favoritos de nuestra comunidad</p>
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
