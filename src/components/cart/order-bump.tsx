"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Plus, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatARS } from "@/lib/money";
import { addToCartAction } from "@/app/(storefront)/actions";
import { track } from "@/lib/analytics/track";
import type { BumpOffer } from "@/lib/catalog/recommend";

/** Order-bump: oferta de un complemento barato para subir el ticket (blueprint 06 §2). */
export function OrderBump({ offer }: { offer: BumpOffer | null }) {
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!offer) return null;

  const add = () =>
    startTransition(async () => {
      const r = await addToCartAction({ variantId: offer.variantId });
      if (r.ok) {
        track("order_bump_added", { productId: offer.productId });
        setAdded(true);
        router.refresh();
      }
    });

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-secondary bg-secondary/30 p-3">
      <Sparkles className="size-5 shrink-0 text-primary" aria-hidden />
      <p className="flex-1 text-sm">
        Sumá <span className="font-semibold">{offer.name}</span> a {formatARS(offer.price)}
      </p>
      <Button size="sm" variant="secondary" onClick={add} disabled={pending || added} className="min-h-11 shrink-0">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : added ? <Check className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
        {added ? "Agregado" : "Agregar"}
      </Button>
    </div>
  );
}
