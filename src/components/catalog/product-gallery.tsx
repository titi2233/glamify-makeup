"use client";

import { useState } from "react";
import { ProductImage } from "@/components/catalog/product-image";
import { cn } from "@/lib/utils";

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const slides = images.length > 0 ? images : [""];
  const [active, setActive] = useState(0);
  return (
    <div className="space-y-3">
      <ProductImage
        src={slides[active] || null}
        alt={name}
        fallbackLabel={name}
        className="rounded-2xl"
        sizes="(max-width:1024px) 100vw, 50vw"
        priority
      />
      {slides.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto">
          {slides.map((src, i) => (
            <li key={i}>
              <button
                type="button"
                aria-label={`Ver imagen ${i + 1}`}
                aria-current={i === active}
                onClick={() => setActive(i)}
                className={cn(
                  "size-16 overflow-hidden rounded-xl border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  i === active ? "border-primary" : "border-border",
                )}
              >
                <ProductImage src={src || null} alt={`${name} ${i + 1}`} fallbackLabel={name} className="rounded-none" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
