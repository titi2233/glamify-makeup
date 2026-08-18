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
      className="group block overflow-hidden rounded-2xl border border-border/80 bg-white shadow-soft transition-all duration-300 hover:shadow-soft-lg hover:border-neutral-300/80 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative overflow-hidden">
        <ProductImage src={product.images[0]} alt={product.name} fallbackLabel={product.name} className="rounded-none" />
        {onSale && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold tracking-wider text-white shadow-sm">
            -{getDiscountPercent(product)}%
          </span>
        )}
        {stockState === "out_of_stock" && (
          <span className="absolute right-2.5 top-2.5">
            <StockBadge state="out_of_stock" />
          </span>
        )}
        <span className="absolute bottom-2.5 right-2.5 z-10">
          <WishlistHeart productId={product.id} />
        </span>
      </div>
      <div className="space-y-1.5 p-4 bg-white">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{product.category.name}</p>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
          {product.name}
        </h3>
        <div className="pt-1">
          <PriceTag
            price={price}
            compareAtPrice={onSale ? toNumber(product.compareAtPrice) : null}
            discountPercent={getDiscountPercent(product)}
            size="sm"
          />
        </div>
        {swatches.length > 0 && (
          <div className="flex items-center gap-1.5 pt-2" aria-hidden>
            {swatches.map((v) => (
              <span
                key={v.id}
                className="size-3.5 rounded-full border border-neutral-200 shadow-2xs"
                style={{ backgroundColor: v.swatchHex ?? undefined }}
              />
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
