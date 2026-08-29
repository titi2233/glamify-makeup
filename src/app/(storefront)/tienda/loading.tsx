import { Skeleton } from "@/components/ui/skeleton";
import { ProductGridSkeleton } from "@/components/catalog/product-grid-skeleton";

export default function TiendaLoading() {
  return (
    <section className="space-y-4 page-enter" aria-busy="true" aria-label="Cargando catálogo...">
      {/* Header con título y controles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-8 w-36" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>
      </div>

      {/* Contador de productos */}
      <Skeleton className="h-4 w-28" />

      {/* Grid de productos */}
      <ProductGridSkeleton count={8} />

      {/* Paginación */}
      <div className="flex justify-center pt-8">
        <Skeleton className="h-10 w-48 rounded-xl" />
      </div>
    </section>
  );
}
