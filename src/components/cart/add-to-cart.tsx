"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VariantSwatchSelector } from "@/components/catalog/variant-swatch-selector";
import { QuantityStepper } from "@/components/catalog/quantity-stepper";
import { useCartUI } from "@/components/cart/cart-provider";
import { addToCartAction } from "@/app/(storefront)/actions";
import { track } from "@/lib/analytics/track";
import type { CatalogVariant } from "@/lib/catalog/types";

export function AddToCart({ variants }: { variants: CatalogVariant[] }) {
  const router = useRouter();
  const { openCart } = useCartUI();
  const firstAvailable = variants.find((v) => v.stock > 0) ?? variants[0];
  const [variantId, setVariantId] = useState<string | undefined>(firstAvailable?.id);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = variants.find((v) => v.id === variantId) ?? firstAvailable;
  const outOfStock = !selected || selected.stock <= 0;

  const add = () =>
    startTransition(async () => {
      setError(null);
      if (!variantId) { setError("Elegí un tono."); return; }
      const r = await addToCartAction({ variantId, qty });
      if (!r.ok) { setError(r.error ?? "No se pudo agregar."); return; }
      track("add_to_cart", { variantId, qty, variantName: selected?.name });
      router.refresh();
      openCart();
    });

  return (
    <div className="space-y-4">
      {variants.length > 0 && <VariantSwatchSelector variants={variants} onChange={(v) => setVariantId(v.id)} />}
      <div className="flex flex-wrap items-center gap-3">
        <QuantityStepper max={Math.max(1, selected?.stock ?? 99)} onChange={setQty} />
        <Button size="lg" className="flex-1" onClick={add} disabled={pending || outOfStock}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />}
          {outOfStock ? "Sin stock" : "Agregar al carrito"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
