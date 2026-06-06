import Link from "next/link";
import { WishlistHeart } from "@/components/catalog/wishlist-heart";
import { ProductImage } from "@/components/catalog/product-image";
import { PriceTag } from "@/components/catalog/price-tag";
import { StockBadge } from "@/components/catalog/stock-badge";
import { getEffectivePrice, isOnSale, getDiscountPercent, toNumber } from "@/lib/catalog/pricing";
import { getProductStockState } from "@/lib/catalog/stock";
import type { CatalogListItem } from "@/lib/catalog/types";

export function ProductCard({ product }: { product: CatalogListItem }) {
  const price = getEffectivePrice(product);
  const onSale = isOnSale(product);
  const stockState = getProductStockState(product.variants);
  const swatches = product.variants.filter((v) => v.swatchHex).slice(0, 5);

  return (
    <Link
      href={`/producto/${product.slug}`}
      className="group block overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative">
        <ProductImage src={product.images[0]} alt={product.name} fallbackLabel={product.name} className="rounded-none" />
        {onSale && (
          <span className="absolute left-2 top-2 rounded-md bg-primary-hover px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
            -{getDiscountPercent(product)}%
          </span>
        )}
        {stockState === "out_of_stock" && (
          <span className="absolute right-2 top-2">
            <StockBadge state="out_of_stock" />
          </span>
        )}
        <span className="absolute bottom-2 right-2 z-10">
          <WishlistHeart productId={product.id} />
        </span>
      </div>
      <div className="space-y-2 p-3">
        <p className="text-xs text-muted-foreground">{product.category.name}</p>
        <h3 className="line-clamp-2 text-sm font-medium leading-snug">{product.name}</h3>
        <PriceTag
          price={price}
          compareAtPrice={onSale ? toNumber(product.compareAtPrice) : null}
          discountPercent={getDiscountPercent(product)}
          size="sm"
        />
        {swatches.length > 0 && (
          <div className="flex items-center gap-1 pt-1" aria-hidden>
            {swatches.map((v) => (
              <span key={v.id} className="size-3.5 rounded-full border border-border" style={{ backgroundColor: v.swatchHex ?? undefined }} />
            ))}
            {product.variants.length > swatches.length && (
              <span className="text-xs text-muted-foreground">+{product.variants.length - swatches.length}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
