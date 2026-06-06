import Link from "next/link";
import { requireCustomer } from "@/lib/customer/auth";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/catalog/product-card";
import { PRODUCT_INCLUDE } from "@/lib/catalog/queries";
import type { CatalogListItem } from "@/lib/catalog/types";

export default async function FavoritosPage() {
  const customer = await requireCustomer();
  const rows = await prisma.wishlist.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    include: { product: { include: PRODUCT_INCLUDE } },
  });
  const products = rows
    .map((r) => r.product)
    .filter((p) => p.active && !p.deletedAt) as CatalogListItem[];

  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
        <p>Todavía no guardaste favoritos.</p>
        <Link href="/tienda" className="mt-3 inline-block text-primary underline">Explorar la tienda</Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {products.map((p) => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}
