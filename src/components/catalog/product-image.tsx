import Image from "next/image";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  src?: string | null;
  alt: string;
  /** texto para el placeholder de marca (ej. nombre del producto) */
  fallbackLabel: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}

const isRemote = (src?: string | null): src is string => !!src && /^https?:\/\//.test(src);

export function ProductImage({ src, alt, fallbackLabel, className, sizes, priority }: ProductImageProps) {
  if (isRemote(src)) {
    return (
      <div className={cn("relative aspect-square overflow-hidden bg-muted", className)}>
        <Image src={src} alt={alt} fill sizes={sizes ?? "(max-width:768px) 50vw, 25vw"} className="object-cover" priority={priority} />
      </div>
    );
  }
  const initial = fallbackLabel.trim().charAt(0).toUpperCase() || "G";
  return (
    <div
      role="img"
      aria-label={alt}
      className={cn(
        "relative flex aspect-square items-center justify-center overflow-hidden bg-gradient-to-br from-secondary via-muted to-surface-alt",
        className,
      )}
    >
      <span aria-hidden className="font-display text-5xl text-primary/70">
        {initial}
      </span>
    </div>
  );
}
