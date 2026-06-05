"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { formatARS } from "@/lib/money";
import { QuantityStepper } from "@/components/catalog/quantity-stepper";
import { updateCartItemAction, removeCartItemAction } from "@/app/(storefront)/actions";

export interface CartLineItemView {
  id: string;
  name: string;
  variantName?: string | null;
  unitPrice: number;
  qty: number;
  image?: string | null;
}

export function CartLineItem({ item }: { item: CartLineItemView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const setQty = (qty: number) =>
    startTransition(async () => {
      await updateCartItemAction(item.id, qty);
      router.refresh();
    });
  const remove = () =>
    startTransition(async () => {
      await removeCartItemAction(item.id);
      router.refresh();
    });

  return (
    <div className="flex gap-3 py-3" data-pending={pending ? "" : undefined}>
      <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {item.image ? <img src={item.image} alt={item.name} className="size-full object-cover" /> : null}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium leading-tight">{item.name}</p>
            {item.variantName && <p className="text-xs text-muted-foreground">{item.variantName}</p>}
          </div>
          <button type="button" onClick={remove} disabled={pending} aria-label="Eliminar" className="text-muted-foreground hover:text-destructive">
            <Trash2 className="size-4" />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <QuantityStepper initial={item.qty} max={99} onChange={setQty} />
          <span className="text-sm font-semibold tabular-nums">{formatARS(item.unitPrice * item.qty)}</span>
        </div>
      </div>
    </div>
  );
}
