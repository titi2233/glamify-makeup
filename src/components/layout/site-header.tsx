import Link from "next/link";
import { User } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { CategoryNav } from "@/components/layout/category-nav";
import { CartButton } from "@/components/cart/cart-button";
import { getCategoryTree } from "@/lib/catalog/queries";
import { getCartView } from "@/lib/cart/cart-view";

export async function SiteHeader() {
  const [tree, { count }] = await Promise.all([getCategoryTree(), getCartView()]);
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md transition-shadow duration-200">
      <div className="container flex h-20 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 group py-2" aria-label="Glamify Makeup Inicio">
          <Logo size="sm" />
        </Link>
        <CategoryNav tree={tree} />
        <div className="flex items-center gap-2">
          <Link
            href="/tienda"
            className="hidden text-sm font-semibold tracking-wider uppercase text-neutral-800 hover:text-primary transition-colors sm:inline px-2 py-1"
          >
            Tienda
          </Link>
          <Link
            href="/cuenta"
            aria-label="Mi cuenta"
            className="hidden p-2.5 text-neutral-700 hover:text-primary transition-colors rounded-full hover:bg-muted md:inline-flex"
          >
            <User className="size-5" aria-hidden />
          </Link>
          <CartButton count={count} />
        </div>
      </div>
    </header>
  );
}
