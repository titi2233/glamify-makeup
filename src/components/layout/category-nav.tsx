import Link from "next/link";
import type { CategoryNode } from "@/lib/catalog/categories";

export function CategoryNav({ tree }: { tree: CategoryNode[] }) {
  return (
    <nav aria-label="Categorías" className="hidden md:block">
      <ul className="flex items-center gap-6">
        {tree.map((cat) => (
          <li key={cat.id} className="group relative">
            <Link href={`/tienda/${cat.slug}`} className="py-2 text-sm font-medium hover:text-primary">
              {cat.name}
            </Link>
            {cat.children.length > 0 && (
              <ul className="absolute left-0 top-full z-20 hidden min-w-44 rounded-xl border border-border bg-popover p-2 shadow-soft-lg group-hover:block group-focus-within:block">
                {cat.children.map((sub) => (
                  <li key={sub.id}>
                    <Link href={`/tienda/${cat.slug}/${sub.slug}`} className="block rounded-lg px-3 py-2 text-sm hover:bg-muted">
                      {sub.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
