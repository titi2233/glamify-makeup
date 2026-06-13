"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCartUI } from "@/components/cart/cart-provider";

export function CartDrawer({ children }: { children: ReactNode }) {
  const { open, setOpen } = useCartUI();
  const pathname = usePathname();
  // Cerrar el drawer al navegar (ej. "Iniciar compra" → /checkout). Sin esto el Sheet
  // queda abierto tapando la vista nueva, sobre todo en mobile (ancho completo).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setOpen(false);
  }, [pathname, setOpen]);
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
