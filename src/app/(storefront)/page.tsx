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
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-secondary via-muted to-surface-alt p-8 text-center md:p-16">
        <h1 className="font-display text-heading-sm font-bold text-foreground md:text-heading-lg">Glam accesible, no humo</h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          Maquillaje y accesorios que te hacen sentir bien, a precio real.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link href="/tienda">Ver tienda</Link>
        </Button>
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
