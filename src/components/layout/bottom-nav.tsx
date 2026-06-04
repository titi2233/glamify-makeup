"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Store, Search, ShoppingBag, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
  { href: "#", label: "Carrito", icon: ShoppingBag, enabled: false },
  { href: "#", label: "Cuenta", icon: User, enabled: false },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background md:hidden">
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const active = item.enabled && (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));
          const Icon = item.icon;
          const content = (
            <span
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px]",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {item.label}
            </span>
          );
          return (
            <li key={item.label}>
              {item.enabled ? (
                <Link href={item.href} aria-current={active ? "page" : undefined}>
                  {content}
                </Link>
              ) : (
                <span aria-disabled="true" title="Próximamente" className="cursor-not-allowed opacity-50">
                  {content}
                  <span className="sr-only">Próximamente</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
