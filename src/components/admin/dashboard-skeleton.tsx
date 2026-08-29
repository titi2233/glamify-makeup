import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 page-enter" aria-busy="true" aria-label="Cargando panel de administración...">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>

      {/* Ventas */}
      <section className="space-y-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-8 rounded-xl" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      </section>

      {/* Para hacer */}
      <section className="space-y-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-8 rounded-xl" />
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      </section>

      {/* Paneles inferiores */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    </div>
  );
}
