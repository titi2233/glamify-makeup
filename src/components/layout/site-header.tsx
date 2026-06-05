import Link from "next/link";
import { CategoryNav } from "@/components/layout/category-nav";
import { CartButton } from "@/components/cart/cart-button";
import { getCategoryTree } from "@/lib/catalog/queries";
import { getCartView } from "@/lib/cart/cart-view";

export async function SiteHeader() {
  const [tree, { count }] = await Promise.all([getCategoryTree(), getCartView()]);
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" className="font-display text-2xl font-bold tracking-tight text-primary">
          Glamify
        </Link>
        <CategoryNav tree={tree} />
        <div className="flex items-center gap-1">
          <Link href="/tienda" className="hidden text-sm font-medium hover:text-primary sm:inline">
            Tienda
          </Link>
          <CartButton count={count} />
        </div>
      </div>
    </header>
  );
}
