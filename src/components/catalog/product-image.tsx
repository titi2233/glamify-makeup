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

/** Convierte un path relativo del bucket product-images a su URL pública completa. */
function resolveImageSrc(src?: string | null): string | null {
  if (!src) return null;
  // Ya es una URL absoluta
  if (/^https?:\/\//.test(src)) return src;
  // Path relativo de Supabase Storage → construir URL pública
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/product-images/${src}`;
}

export function ProductImage({ src, alt, fallbackLabel, className, sizes, priority }: ProductImageProps) {
  const resolved = resolveImageSrc(src);
  if (resolved) {
    return (
      <div className={cn("relative aspect-square overflow-hidden bg-muted", className)}>
        <Image src={resolved} alt={alt} fill sizes={sizes ?? "(max-width:768px) 50vw, 25vw"} className="object-cover" priority={priority} />
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

