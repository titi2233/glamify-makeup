"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ShoppingBag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatARS } from "@/lib/money";
import { productImageUrl } from "@/lib/images";
import { useCartUI } from "@/components/cart/cart-provider";
import { addToCartAction } from "@/app/(storefront)/actions";
import { track } from "@/lib/analytics/track";
import type { CatalogVariant } from "@/lib/catalog/types";

interface MobileStickyBuyBarProps {
  productName: string;
  image?: string | null;
  price: number;
  variants: CatalogVariant[];
  selectedVariantId?: string;
}

export function MobileStickyBuyBar({
  productName,
  image,
  price,
  variants,
  selectedVariantId,
}: MobileStickyBuyBarProps) {
  const router = useRouter();
  const { openCart } = useCartUI();
  const [visible, setVisible] = useState(false);
  const [pending, startTransition] = useTransition();

  const activeVariant =
    variants.find((v) => v.id === selectedVariantId) ??
    variants.find((v) => v.stock > 0) ??
    variants[0];

  const outOfStock = !activeVariant || activeVariant.stock <= 0;
  const imgUrl = productImageUrl(activeVariant?.image ?? image);

  useEffect(() => {
    const target = document.getElementById("main-pdp-cta");
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Si el botón principal no está en el viewport, mostramos la barra sticky
        setVisible(!entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const handleQuickAdd = () => {
    if (!activeVariant || outOfStock) return;
    startTransition(async () => {
      const res = await addToCartAction({ variantId: activeVariant.id, qty: 1 });
      if (res.ok) {
        track("add_to_cart", { variantId: activeVariant.id, qty: 1, variantName: activeVariant.name, source: "mobile_sticky" });
        router.refresh();
        openCart();
      }
    });
  };

  return (
    <div
      className={`fixed bottom-14 left-0 right-0 z-20 border-t border-border/80 bg-white/95 backdrop-blur-md p-3 shadow-soft-lg transition-transform duration-300 md:hidden ${
        visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-secondary border border-border/60">
            {imgUrl ? (
              <Image src={imgUrl} alt={productName} fill className="object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-xs font-bold text-muted-foreground">
                G
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-xs font-bold text-foreground">{productName}</h4>
            <p className="text-xs font-bold text-foreground">
              {formatARS(price)}
              {activeVariant && (
                <span className="ml-1.5 font-normal text-muted-foreground">({activeVariant.name})</span>
              )}
            </p>
          </div>
        </div>

        <Button
          size="sm"
          onClick={handleQuickAdd}
          disabled={pending || outOfStock}
          className="shrink-0 rounded-xl px-4 py-2 bg-[#161413] text-white text-xs font-bold"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ShoppingBag className="size-3.5" />
          )}
          <span>{outOfStock ? "Agotado" : "Comprar"}</span>
        </Button>
      </div>
    </div>
  );
}
