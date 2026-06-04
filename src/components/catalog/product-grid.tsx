import { ProductCard } from "@/components/catalog/product-card";
import type { CatalogListItem } from "@/lib/catalog/types";

export function ProductGrid({ products }: { products: CatalogListItem[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-4">
      {products.map((p) => (
        <li key={p.id}>
          <ProductCard product={p} />
        </li>
      ))}
    </ul>
  );
}
