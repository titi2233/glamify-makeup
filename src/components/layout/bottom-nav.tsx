"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Store, Search, ShoppingBag, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCartUI } from "@/components/cart/cart-provider";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  enabled: boolean;
}

const ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home, enabled: true },
  { href: "/tienda", label: "Tienda", icon: Store, enabled: true },
  { href: "#", label: "Buscar", icon: Search, enabled: false },
  { href: "/carrito", label: "Carrito", icon: ShoppingBag, enabled: true },
  { href: "/cuenta", label: "Cuenta", icon: User, enabled: true },
];

export function BottomNav({ cartCount = 0 }: { cartCount?: number }) {
  const pathname = usePathname();
  const { openCart } = useCartUI();

  return (
    <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-white/95 backdrop-blur-md md:hidden">
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const isCart = item.label === "Carrito";
          const active = item.enabled && (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));
          const Icon = item.icon;
          const content = (
            <span className={cn("relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors", active ? "text-primary font-bold" : "text-muted-foreground")}>
              <Icon className={cn("size-5 transition-transform", active && "scale-110")} aria-hidden />
              {isCart && cartCount > 0 && (
                <span className="absolute right-1/4 top-1.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-white tabular-nums shadow-xs">{cartCount}</span>
              )}
              <span>{item.label}</span>
            </span>
          );

          if (isCart) {
            return (
              <li key={item.label}>
                <button type="button" onClick={openCart} aria-label={`Carrito${cartCount > 0 ? ` (${cartCount})` : ""}`} className="w-full">
                  {content}
                </button>
              </li>
            );
          }
          return (
            <li key={item.label}>
              {item.enabled ? (
                <Link href={item.href} aria-current={active ? "page" : undefined}>{content}</Link>
              ) : (
                <span aria-disabled="true" title="Próximamente" className="cursor-not-allowed opacity-40">
                  {content}<span className="sr-only">Próximamente</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
