import { Skeleton } from "@/components/ui/skeleton";

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-white shadow-soft">
      {/* Imagen cuadrada */}
      <Skeleton className="aspect-square w-full rounded-none" />

      {/* Info */}
      <div className="space-y-2 p-4">
        {/* Categoría */}
        <Skeleton className="h-2.5 w-14 rounded-md" />

        {/* Título (2 líneas) */}
        <div className="space-y-1 pt-0.5">
          <Skeleton className="h-3.5 w-full rounded-md" />
          <Skeleton className="h-3.5 w-3/4 rounded-md" />
        </div>

        {/* Precio */}
        <div className="pt-1.5">
          <Skeleton className="h-4.5 w-24 rounded-md" />
        </div>

        {/* Swatches de tonos */}
        <div className="flex items-center gap-1.5 pt-2">
          <Skeleton className="size-3.5 rounded-full" />
          <Skeleton className="size-3.5 rounded-full" />
          <Skeleton className="size-3.5 rounded-full" />
        </div>
      </div>
    </div>
  );
}
