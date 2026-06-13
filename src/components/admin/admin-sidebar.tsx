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
  Star,
  Sparkles,
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
  { href: "/admin/resenas", label: "Reseñas", icon: Star },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

/** Lockup de marca: medallón con degradé + wordmark serif. */
function BrandMark() {
  return (
    <Link
      href="/admin"
      className="flex items-center gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="icon-medallion grid size-10 shrink-0 place-items-center rounded-2xl font-display text-lg font-bold">
        G
      </span>
      <span className="min-w-0">
        <span className="block font-display text-xl font-bold leading-none text-foreground">
          Glamify
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <Sparkles className="size-3 text-primary" aria-hidden />
          Panel de la dueña
        </span>
      </span>
    </Link>
  );
}

export function AdminSidebar({
  email,
  logout,
}: {
  email?: string;
  logout?: React.ReactNode;
}) {
  const pathname = usePathname();
  const initials = (email?.trim()?.[0] ?? "G").toUpperCase();

  return (
    <>
      {/* Desktop: sidebar fija a la izquierda */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border/70 bg-card/80 backdrop-blur md:flex">
        <div className="px-5 py-6">
          <BrandMark />
        </div>

        <nav aria-label="Navegación del panel" className="flex-1 px-3">
          <ul className="space-y-1.5">
            {ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex min-h-11 items-center gap-3 rounded-2xl px-2.5 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-gradient-to-r from-primary-hover to-primary text-primary-foreground shadow-glow"
                        : "text-foreground/80 hover:bg-white hover:text-foreground hover:shadow-soft",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-xl transition-colors",
                        active
                          ? "bg-white/25 text-primary-foreground"
                          : "bg-primary/10 text-primary group-hover:bg-primary/15",
                      )}
                    >
                      <Icon className="size-[18px]" aria-hidden />
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Chip de la dueña + salir */}
        {logout ? (
          <div className="m-3 rounded-2xl border border-border/70 bg-surface-alt p-3">
            <div className="mb-2 flex items-center gap-2.5">
              <span className="icon-medallion grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">Conectada</p>
                {email ? (
                  <p className="truncate text-[11px] text-muted-foreground" title={email}>
                    {email}
                  </p>
                ) : null}
              </div>
            </div>
            {logout}
          </div>
        ) : null}
      </aside>

      {/* Mobile: bottom nav fija */}
      <nav
        aria-label="Navegación del panel"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-card/90 backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-7">
          {ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-8 place-items-center rounded-full transition-colors",
                      active ? "bg-primary/12 text-primary" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
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
