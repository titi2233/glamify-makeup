"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStockState } from "@/lib/catalog/stock";
import { StockBadge } from "@/components/catalog/stock-badge";
import type { CatalogVariant } from "@/lib/catalog/types";

interface VariantSwatchSelectorProps {
  variants: CatalogVariant[];
  onChange?: (variant: CatalogVariant) => void;
}

export function VariantSwatchSelector({ variants, onChange }: VariantSwatchSelectorProps) {
  const firstAvailable = variants.find((v) => v.stock > 0) ?? variants[0];
  const [selectedId, setSelectedId] = useState(firstAvailable?.id);
  const selected = variants.find((v) => v.id === selectedId) ?? firstAvailable;

  const select = (v: CatalogVariant) => {
    setSelectedId(v.id);
    onChange?.(v);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">
          Tono: <span className="text-muted-foreground">{selected?.name}</span>
        </span>
        {selected && <StockBadge state={getStockState(selected)} stock={selected.stock} />}
      </div>
      <ul className="flex flex-wrap gap-2" role="radiogroup" aria-label="Elegí un tono">
        {variants.map((v) => {
          const out = v.stock <= 0;
          const isSelected = v.id === selected?.id;
          return (
            <li key={v.id}>
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`${v.name}${out ? " (sin stock)" : ""}`}
                disabled={out}
                onClick={() => select(v)}
                className={cn(
                  "relative size-11 rounded-full border-2 transition active:scale-[0.97]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isSelected ? "border-primary" : "border-border",
                  out && "cursor-not-allowed opacity-40",
                )}
                style={v.swatchHex ? { backgroundColor: v.swatchHex } : undefined}
              >
                {!v.swatchHex && <span className="text-xs">{v.name.charAt(0)}</span>}
                {isSelected && (
                  <Check className="absolute inset-0 m-auto size-5 text-white drop-shadow" aria-hidden strokeWidth={3} />
                )}
                {out && <span className="absolute inset-x-0 top-1/2 h-0.5 -rotate-45 bg-foreground/60" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
