import { ProductGrid } from "@/components/catalog/product-grid";
import type { CatalogProduct } from "@/lib/catalog/types";

/** "Te puede gustar": cross-sell de productos relacionados (blueprint 06 §2). */
export function CrossSell({ products, title = "Te puede gustar" }: { products: CatalogProduct[]; title?: string }) {
  if (products.length === 0) return null;
  return (
    <section className="border-t border-border pt-6">
      <h2 className="mb-4 font-display text-lg">{title}</h2>
      <ProductGrid products={products} />
    </section>
  );
}
