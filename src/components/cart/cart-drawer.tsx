"use client";

import { type ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCartUI } from "@/components/cart/cart-provider";

export function CartDrawer({ children }: { children: ReactNode }) {
  const { open, setOpen } = useCartUI();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-xl">Tu carrito</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
