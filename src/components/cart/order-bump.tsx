"use client";

import { useEffect, useState, useTransition } from "react";
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

  // Si tras agregar el refresh trae otra oferta a este slot, reseteamos el estado "Agregado".
  useEffect(() => setAdded(false), [offer?.variantId]);

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
    <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-secondary/60 p-3.5 shadow-2xs">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-2xs text-primary">
        <Sparkles className="size-4" aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Completá tu look</p>
        <p className="truncate text-xs font-semibold text-foreground">
          {offer.name} · <span className="font-bold text-foreground">{formatARS(offer.price)}</span>
        </p>
      </div>
      <Button
        size="sm"
        onClick={add}
        disabled={pending || added}
        className="shrink-0 rounded-xl px-3.5 h-9 bg-white text-foreground border border-border hover:bg-neutral-50 text-xs font-semibold shadow-2xs"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : added ? <Check className="size-3.5 text-emerald-600" aria-hidden /> : <Plus className="size-3.5 text-primary" aria-hidden />}
        <span>{added ? "Agregado" : "+ Agregar"}</span>
      </Button>
    </div>
  );
}
