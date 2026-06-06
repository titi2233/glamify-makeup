"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function RatingStars({ value, size = "md" }: { value: number; size?: "sm" | "md" }) {
  const px = size === "sm" ? "size-3.5" : "size-5";
  return (
    <span className="inline-flex" aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn(px, n <= Math.round(value) ? "fill-primary text-primary" : "text-border")} aria-hidden />
      ))}
    </span>
  );
}

export function RatingInput({ name, defaultValue = 0 }: { name: string; defaultValue?: number }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <span className="inline-flex gap-1" role="radiogroup" aria-label="Puntaje">
      <input type="hidden" name={name} value={value} />
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} estrella${n > 1 ? "s" : ""}`} onClick={() => setValue(n)}>
          <Star className={cn("size-7", n <= value ? "fill-primary text-primary" : "text-border")} aria-hidden />
        </button>
      ))}
    </span>
  );
}
