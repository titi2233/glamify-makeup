"use client";

import { useState } from "react";
import Link from "next/link";
import type { CategoryNode } from "@/lib/catalog/categories";

/**
 * Nav de categorías con submenús estilo editorial.
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
      <ul className="flex items-center gap-8">
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
                className="group relative flex items-center py-2 text-[14px] font-medium text-foreground/80 hover:text-primary transition-colors select-none"
              >
                <span>{cat.name}</span>
                {/* Indicador de barra inferior sutil al hover */}
                <span className="absolute inset-x-0 -bottom-0.5 h-[2px] bg-primary scale-x-0 transition-transform duration-200 ease-out group-hover:scale-x-100" />
              </Link>
              {hasChildren && isOpen && (
                <ul className="absolute left-1/2 -translate-x-1/2 top-full z-20 min-w-48 rounded-2xl border border-border/80 bg-white/95 backdrop-blur-md p-2 text-foreground shadow-soft-lg animate-fade-up">
                  {cat.children.map((sub) => (
                    <li key={sub.id}>
                      <Link
                        href={`/tienda/${cat.slug}/${sub.slug}`}
                        className="block rounded-xl px-3.5 py-2 text-xs font-medium text-foreground/80 hover:bg-secondary hover:text-primary transition-colors"
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
