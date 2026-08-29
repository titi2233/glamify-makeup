import { Skeleton } from "@/components/ui/skeleton";

export default function CuentaLoading() {
  return (
    <div className="space-y-6 page-enter" aria-busy="true" aria-label="Cargando cuenta...">
      <Skeleton className="h-5 w-40" />

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Card 1: Últimos pedidos */}
        <div className="rounded-2xl border border-border bg-white p-4 shadow-soft space-y-3">
          <Skeleton className="h-4 w-28" />
          <div className="space-y-2 pt-1">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        </div>

        {/* Card 2: Favoritos */}
        <div className="rounded-2xl border border-border bg-white p-4 shadow-soft space-y-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-12" />
        </div>
      </div>
    </div>
  );
}
