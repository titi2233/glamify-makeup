"use client";

import { ShoppingBag } from "lucide-react";
import { useCartUI } from "@/components/cart/cart-provider";
import { cn } from "@/lib/utils";

export function CartButton({ count, className }: { count: number; className?: string }) {
  const { openCart } = useCartUI();
  return (
    <button
      type="button"
      onClick={openCart}
      aria-label={`Carrito${count > 0 ? ` (${count})` : ""}`}
      className={cn(
        "relative grid size-11 place-items-center rounded-full text-neutral-800 hover:text-primary hover:bg-muted transition-colors",
        className
      )}
    >
      <ShoppingBag className="size-5" aria-hidden />
      {count > 0 && (
        <span className="absolute right-1 top-1 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-white tabular-nums shadow-xs">
          {count}
        </span>
      )}
    </button>
  );
}
