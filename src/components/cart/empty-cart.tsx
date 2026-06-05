import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyCart() {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <ShoppingBag className="size-12 text-muted-foreground" aria-hidden />
      <div>
        <p className="font-display text-lg">Tu carrito está vacío</p>
        <p className="text-sm text-muted-foreground">Sumá tus productos favoritos y volvé.</p>
      </div>
      <Button asChild><Link href="/tienda">Ir a la tienda</Link></Button>
    </div>
  );
}
