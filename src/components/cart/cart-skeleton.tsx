import { Skeleton } from "@/components/ui/skeleton";
import { ProductCardSkeleton } from "@/components/catalog/product-card-skeleton";

export function CartSkeleton() {
  return (
    <div className="mx-auto max-w-4xl py-6 page-enter" aria-busy="true" aria-label="Cargando carrito...">
      <Skeleton className="mb-6 h-8 w-44" />

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Columna Izquierda: Items del carrito */}
        <div className="space-y-4">
          {/* Barra de envío gratis */}
          <Skeleton className="h-10 w-full rounded-xl" />

          {/* Lista de productos */}
          <div className="divide-y divide-border rounded-2xl border border-border bg-white px-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 py-4">
                <Skeleton className="size-16 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-24 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Columna Derecha: Resumen lateral */}
        <aside className="space-y-4 rounded-2xl border border-border bg-white p-5 lg:sticky lg:top-20 lg:self-start">
          <Skeleton className="h-10 w-full rounded-xl" />
          <div className="space-y-2 pt-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex justify-between pt-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-28" />
            </div>
          </div>
          <Skeleton className="h-12 w-full rounded-xl pt-2" />
        </aside>
      </div>

      {/* Cross-sell */}
      <div className="mt-12 space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <ProductCardSkeleton />
          <ProductCardSkeleton />
          <ProductCardSkeleton />
          <ProductCardSkeleton />
        </div>
      </div>
    </div>
  );
}
