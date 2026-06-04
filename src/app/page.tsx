import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-surface-alt px-6 py-16 text-center">
      <span className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-1.5 text-sm font-medium text-primary">
        <Sparkles className="size-4" />
        Próximamente
      </span>

      <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
        Glamify <span className="text-primary">Makeup</span>
      </h1>

      <p className="max-w-md text-balance text-base text-muted-foreground sm:text-lg">
        Glam accesible: maquillaje y accesorios lindos, en tendencia y a buen
        precio. Estamos preparando la tienda. 💄
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button size="lg">Ver tienda</Button>
        <Button size="lg" variant="outline">
          Conocer la marca
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        © {new Date().getFullYear()} Glamify Makeup · Luján, Buenos Aires
      </p>
    </main>
  );
}
