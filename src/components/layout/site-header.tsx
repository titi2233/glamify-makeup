import Link from "next/link";
import { CategoryNav } from "@/components/layout/category-nav";
import { getCategoryTree } from "@/lib/catalog/queries";

export async function SiteHeader() {
  const tree = await getCategoryTree();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" className="font-display text-2xl font-bold tracking-tight text-primary">
          Glamify
        </Link>
        <CategoryNav tree={tree} />
        <Link href="/tienda" className="text-sm font-medium hover:text-primary">
          Tienda
        </Link>
      </div>
    </header>
  );
}
