import Image from "next/image";
import { cn } from "@/lib/utils";
import { productImageUrl } from "@/lib/images";

interface ProductImageProps {
  src?: string | null;
  alt: string;
  /** texto para el placeholder de marca (ej. nombre del producto) */
  fallbackLabel: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}

export function ProductImage({ src, alt, fallbackLabel, className, sizes, priority }: ProductImageProps) {
  const url = productImageUrl(src);
  if (url) {
    return (
      <div className={cn("relative aspect-square overflow-hidden bg-muted/60", className)}>
        <Image
          src={url}
          alt={alt}
          fill
          sizes={sizes ?? "(max-width:768px) 50vw, 25vw"}
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          priority={priority}
        />
      </div>
    );
  }
  const initial = fallbackLabel.trim().charAt(0).toUpperCase() || "G";
  return (
    <div
      role="img"
      aria-label={alt}
      className={cn(
        "relative flex aspect-square items-center justify-center overflow-hidden bg-gradient-to-br from-secondary/80 via-muted to-white border-b border-border/40",
        className
      )}
    >
      <span aria-hidden className="font-display text-5xl font-bold text-primary/75 select-none transition-transform duration-300 group-hover:scale-110">
        {initial}
      </span>
    </div>
  );
}
