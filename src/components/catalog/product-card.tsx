import Link from "next/link";
import Image from "next/image";
import { WishlistHeart } from "@/components/catalog/wishlist-heart";
import { PriceTag } from "@/components/catalog/price-tag";
import { StockBadge } from "@/components/catalog/stock-badge";
import { productImageUrl } from "@/lib/images";
import { getEffectivePrice, isOnSale, getDiscountPercent, toNumber } from "@/lib/catalog/pricing";
import { getProductStockState } from "@/lib/catalog/stock";
import type { CatalogListItem } from "@/lib/catalog/types";

export function ProductCard({ product }: { product: CatalogListItem }) {
  const price = getEffectivePrice(product);
  const onSale = isOnSale(product);
  const stockState = getProductStockState(product.variants);
  const swatches = product.variants.filter((v) => v.swatchHex).slice(0, 5);
  const primaryUrl = productImageUrl(product.images[0]);
  const secondaryUrl = product.images[1] ? productImageUrl(product.images[1]) : null;

  return (
    <Link
      href={`/producto/${product.slug}`}
      className="group block overflow-hidden rounded-2xl border border-border/80 bg-white shadow-soft transition-all duration-300 hover:shadow-soft-lg hover:-translate-y-1.5 hover:border-neutral-300/80 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-secondary skeleton-shimmer">
        {primaryUrl ? (
          <>
            <Image
              src={primaryUrl}
              alt={product.name}
              fill
              sizes="(max-width:768px) 50vw, 25vw"
              className={`object-cover transition-all duration-500 ease-out group-hover:scale-105 ${
                secondaryUrl ? "group-hover:opacity-0" : ""
              }`}
            />
            {secondaryUrl && (
              <Image
                src={secondaryUrl}
                alt={`${product.name} - detalle`}
                fill
                sizes="(max-width:768px) 50vw, 25vw"
                className="object-cover opacity-0 transition-all duration-500 ease-out group-hover:opacity-100 group-hover:scale-105"
              />
            )}
          </>
        ) : (
          <div className="relative flex aspect-square items-center justify-center bg-gradient-to-br from-secondary via-muted to-white">
            <span className="font-display text-5xl font-bold text-primary/70">
              {product.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Badges */}
        <div className="absolute left-2.5 top-2.5 flex flex-col gap-1 z-10">
          {onSale && (
            <span className="rounded-full bg-[#161413] px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-white shadow-sm uppercase">
              -{getDiscountPercent(product)}% OFF
            </span>
          )}
        </div>

        {stockState === "out_of_stock" && (
          <span className="absolute right-2.5 top-2.5 z-10">
            <StockBadge state="out_of_stock" />
          </span>
        )}

        <span className="absolute bottom-2.5 right-2.5 z-10">
          <WishlistHeart productId={product.id} />
        </span>
      </div>

      <div className="space-y-1.5 p-4 bg-white">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{product.category.name}</p>
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
          <div className="flex items-center gap-1.5 pt-2" aria-label={`${product.variants.length} tonos disponibles`}>
            {swatches.map((v) => (
              <span
                key={v.id}
                title={v.name}
                className="size-3.5 rounded-full border border-neutral-300/80 shadow-2xs transition-transform duration-200 group-hover:scale-110"
                style={{ backgroundColor: v.swatchHex ?? undefined }}
              />
            ))}
            {product.variants.length > swatches.length && (
              <span className="text-[11px] font-medium text-muted-foreground">+{product.variants.length - swatches.length}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
