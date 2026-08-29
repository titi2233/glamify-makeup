import { Skeleton } from "@/components/ui/skeleton";

export default function PedidosLoading() {
  return (
    <div className="space-y-3 page-enter" aria-busy="true" aria-label="Cargando historial de pedidos...">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-2xl border border-border bg-white p-4 shadow-soft"
        >
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
