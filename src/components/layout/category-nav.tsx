"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
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
      <ul className="flex items-center gap-7">
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
                className="group flex items-center gap-1.5 py-2 text-sm font-semibold tracking-wide uppercase text-neutral-800 hover:text-primary transition-colors"
              >
                <span>{cat.name}</span>
                {hasChildren && (
                  <ChevronDown className="size-3.5 opacity-50 transition-transform duration-200 group-hover:rotate-180" aria-hidden />
                )}
              </Link>
              {hasChildren && isOpen && (
                <ul className="absolute left-0 top-full z-20 min-w-48 rounded-2xl border border-border bg-white/95 backdrop-blur-md p-2 text-foreground shadow-soft-lg animate-fade-up">
                  {cat.children.map((sub) => (
                    <li key={sub.id}>
                      <Link
                        href={`/tienda/${cat.slug}/${sub.slug}`}
                        className="block rounded-xl px-3.5 py-2.5 text-sm font-medium hover:bg-muted hover:text-primary transition-colors"
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
