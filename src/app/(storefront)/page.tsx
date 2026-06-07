import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductGrid } from "@/components/catalog/product-grid";
import { ProductImage } from "@/components/catalog/product-image";
import { getCategoryTree, getFeaturedProducts, getNewestProducts } from "@/lib/catalog/queries";
import { buildWebSiteJsonLd, buildOrganizationJsonLd, serializeJsonLd } from "@/lib/seo/jsonld";
import { appBaseUrl } from "@/lib/seo/url";

export default async function HomePage() {
  const [tree, featuredRaw] = await Promise.all([getCategoryTree(), getFeaturedProducts(8)]);
  const featured = featuredRaw.length > 0 ? featuredRaw : await getNewestProducts(8);
  const base = appBaseUrl();
  const jsonLd = [buildWebSiteJsonLd(base), buildOrganizationJsonLd(base)];

  return (
    <div className="space-y-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-secondary via-muted to-surface-alt grid grid-cols-1 md:grid-cols-2 gap-8 items-center p-8 md:p-12">
        <div className="text-center md:text-left space-y-4">
          <h1 className="font-display text-heading-sm font-bold text-foreground md:text-heading-lg leading-tight">
            Maquillaje bueno, bonito y barato
          </h1>
          <p className="max-w-md text-muted-foreground mx-auto md:mx-0">
            Maquillaje y accesorios que te hacen sentir bien, a precio real.
          </p>
          <div className="pt-2">
            <Button asChild size="lg">
              <Link href="/tienda">Ver tienda</Link>
            </Button>
          </div>
        </div>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl shadow-soft">
          <img
            src="/images/hero_banner.png"
            alt="Glamify Makeup - Maquillaje bueno, bonito y barato"
            className="h-full w-full object-cover"
          />
        </div>
      </section>

      {/* Categorías destacadas */}
      <section>
        <h2 className="mb-4 font-display text-2xl uppercase tracking-wide">Categorías</h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {tree.map((cat) => (
            <li key={cat.id}>
              <Link
                href={`/tienda/${cat.slug}`}
                className="group block overflow-hidden rounded-2xl border border-border shadow-soft transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ProductImage src={cat.image} alt={cat.name} fallbackLabel={cat.name} className="rounded-none" />
                <span className="block p-3 text-center text-sm font-medium">{cat.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Héroes de catálogo */}
      {featured.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-2xl uppercase tracking-wide">Destacados</h2>
          <ProductGrid products={featured} />
        </section>
      )}
    </div>
  );
}
