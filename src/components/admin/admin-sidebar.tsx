"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Layers,
  Ticket,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Inicio", icon: LayoutDashboard },
  { href: "/admin/productos", label: "Productos", icon: Package },
  { href: "/admin/categorias", label: "Categorías", icon: FolderTree },
  { href: "/admin/combos", label: "Combos", icon: Layers },
  { href: "/admin/cupones", label: "Cupones", icon: Ticket },
  { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingCart },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export function AdminSidebar({ logout }: { logout?: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: sidebar fija a la izquierda */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card md:flex">
        <div className="px-6 py-5">
          <Link href="/admin" className="font-display text-xl font-bold text-primary">
            Glamify
          </Link>
          <p className="text-xs text-muted-foreground">Panel de la dueña</p>
        </div>
        <nav aria-label="Navegación del panel" className="flex-1 px-3">
          <ul className="space-y-1">
            {ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
                      active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        {logout ? <div className="border-t border-border p-3">{logout}</div> : null}
      </aside>

      {/* Mobile: bottom nav fija */}
      <nav
        aria-label="Navegación del panel"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card md:hidden"
      >
        <ul className="grid grid-cols-6">
          {ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center gap-0.5 text-[10px]",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
