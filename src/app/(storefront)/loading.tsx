import { Skeleton } from "@/components/ui/skeleton";
import { ProductGridSkeleton } from "@/components/catalog/product-grid-skeleton";

export default function StorefrontHomeLoading() {
  return (
    <div className="space-y-16 pb-12 page-enter" aria-busy="true" aria-label="Cargando página principal...">
      {/* Banner Hero Skeleton */}
      <Skeleton className="h-64 sm:h-80 w-full rounded-2xl" />

      {/* Propuestas de Valor Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>

      {/* Categorías Destacadas Skeleton */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-border/60 pb-3">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border/80 bg-white">
              <Skeleton className="aspect-square w-full rounded-none" />
              <div className="p-3.5 bg-white flex justify-center">
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Los Más Elegidos Skeleton */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-border/60 pb-3">
          <div className="space-y-2">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-4 w-24" />
        </div>
        <ProductGridSkeleton count={4} />
      </section>
    </div>
  );
}
