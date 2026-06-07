"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { CategoryNode } from "@/lib/catalog/categories";

/**
 * Nav de categorías con submenús. Estado único `openId`: solo un dropdown abierto
 * a la vez (abrir uno cierra el otro), tanto por hover como por foco de teclado.
 * Evita la superposición que causaba `group-focus-within` (categoría clickeada
 * quedaba abierta mientras el hover abría otra).
 */
export function CategoryNav({ tree }: { tree: CategoryNode[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <nav
      aria-label="Categorías"
      className="hidden md:block"
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpenId(null);
      }}
    >
      <ul className="flex items-center gap-6">
        {tree.map((cat) => {
          const hasChildren = cat.children.length > 0;
          const isOpen = openId === cat.id;
          return (
            <li
              key={cat.id}
              className="relative"
              onMouseEnter={() => setOpenId(hasChildren ? cat.id : null)}
              onMouseLeave={() => setOpenId((cur) => (cur === cat.id ? null : cur))}
              onFocus={() => setOpenId(hasChildren ? cat.id : null)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setOpenId((cur) => (cur === cat.id ? null : cur));
                }
              }}
            >
              <Link
                href={`/tienda/${cat.slug}`}
                aria-expanded={hasChildren ? isOpen : undefined}
                className="flex items-center gap-1 py-2 text-sm font-medium hover:text-primary"
              >
                {cat.name}
                {hasChildren && <ChevronDown className="size-4 opacity-60" aria-hidden />}
              </Link>
              {hasChildren && isOpen && (
                <ul className="absolute left-0 top-full z-20 min-w-44 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-soft-lg">
                  {cat.children.map((sub) => (
                    <li key={sub.id}>
                      <Link
                        href={`/tienda/${cat.slug}/${sub.slug}`}
                        className="block rounded-lg px-3 py-2 text-sm hover:bg-muted"
                      >
                        {sub.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
