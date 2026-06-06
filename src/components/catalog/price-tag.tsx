import { formatARS } from "@/lib/money";
import { cn } from "@/lib/utils";

interface PriceTagProps {
  /** precio efectivo a mostrar (number en ARS) */
  price: number;
  /** precio "antes" si está en oferta (compareAtPrice) */
  compareAtPrice?: number | null;
  /** % de descuento (>0 muestra el badge) */
  discountPercent?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = { sm: "text-base", md: "text-lg", lg: "text-2xl" } as const;

export function PriceTag({ price, compareAtPrice, discountPercent = 0, size = "md", className }: PriceTagProps) {
  const onSale = !!compareAtPrice && compareAtPrice > price;
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}>
      <span className={cn("font-semibold tabular-nums text-foreground", sizeMap[size])}>{formatARS(price)}</span>
      {onSale && (
        <>
          <span
            className="text-sm tabular-nums text-muted-foreground line-through"
            aria-label={`Precio anterior ${formatARS(compareAtPrice)}`}
          >
            {formatARS(compareAtPrice)}
          </span>
          {discountPercent > 0 && (
            <span className="rounded-md bg-primary-hover px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
              -{discountPercent}%
            </span>
          )}
        </>
      )}
    </div>
  );
}
