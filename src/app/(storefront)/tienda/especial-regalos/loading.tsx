import { Skeleton } from "@/components/ui/skeleton";
import { ProductGridSkeleton } from "@/components/catalog/product-grid-skeleton";

export default function EspecialRegalosLoading() {
  return (
    <section className="space-y-4 page-enter" aria-busy="true" aria-label="Cargando Especial Regalos...">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="h-4 w-28" />
      <ProductGridSkeleton count={8} />
      <div className="flex justify-center pt-8">
        <Skeleton className="h-10 w-48 rounded-xl" />
      </div>
    </section>
  );
}
