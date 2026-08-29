import { Skeleton } from "@/components/ui/skeleton";

export function ProductDetailSkeleton() {
  return (
    <div className="space-y-10 pb-8 page-enter" aria-busy="true" aria-label="Cargando producto...">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-16" />
        <span className="text-muted-foreground/40">/</span>
        <Skeleton className="h-4 w-24" />
        <span className="text-muted-foreground/40">/</span>
        <Skeleton className="h-4 w-36" />
      </div>

      {/* 50/50 Desktop Sticky Layout */}
      <div className="grid gap-10 lg:grid-cols-12 items-start">
        {/* Columna Izquierda: Galería */}
        <div className="space-y-4 lg:col-span-7">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="flex items-center gap-3">
            <Skeleton className="size-16 sm:size-20 rounded-xl" />
            <Skeleton className="size-16 sm:size-20 rounded-xl" />
            <Skeleton className="size-16 sm:size-20 rounded-xl" />
            <Skeleton className="size-16 sm:size-20 rounded-xl" />
          </div>
        </div>

        {/* Columna Derecha: Información y Compra */}
        <div className="space-y-6 lg:col-span-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="size-8 rounded-full" />
            </div>
            <Skeleton className="h-8 w-4/5" />
            <Skeleton className="h-4 w-32 pt-0.5" />
          </div>

          {/* Precio */}
          <div className="py-1">
            <Skeleton className="h-8 w-36" />
          </div>

          {/* Selector de tonos / variantes */}
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <div className="flex items-center gap-2">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="size-8 rounded-full" />
            </div>
          </div>

          {/* Botón Agregar al Carrito */}
          <div className="space-y-2 pt-2">
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>

          {/* Trust Badges */}
          <Skeleton className="h-20 w-full rounded-xl" />

          {/* Acordeones informativos */}
          <div className="space-y-2 pt-2">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
