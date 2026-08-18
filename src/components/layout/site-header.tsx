import Link from "next/link";
import { User } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { CategoryNav } from "@/components/layout/category-nav";
import { CartButton } from "@/components/cart/cart-button";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { getCategoryTree } from "@/lib/catalog/queries";
import { getCartView } from "@/lib/cart/cart-view";

export async function SiteHeader() {
  const [tree, { count }] = await Promise.all([getCategoryTree(), getCartView()]);
  return (
    <header className="sticky top-0 z-30 transition-shadow duration-200">
      <AnnouncementBar />
      <div className="border-b border-border/80 bg-background/95 backdrop-blur-md">
        <div className="container flex h-20 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 group py-2" aria-label="Glamify Makeup Inicio">
            <Logo size="sm" />
          </Link>
          <CategoryNav tree={tree} />
          <div className="flex items-center gap-3">
            <Link
              href="/tienda"
              className="hidden text-xs font-bold tracking-widest uppercase text-foreground/80 hover:text-primary transition-colors sm:inline-block px-3 py-1.5 rounded-full hover:bg-muted"
            >
              Tienda
            </Link>
            <Link
              href="/cuenta"
              aria-label="Mi cuenta"
              className="hidden p-2.5 text-foreground/80 hover:text-primary transition-colors rounded-full hover:bg-muted md:inline-flex"
            >
              <User className="size-5" aria-hidden />
            </Link>
            <CartButton count={count} />
          </div>
        </div>
      </div>
    </header>
  );
}
