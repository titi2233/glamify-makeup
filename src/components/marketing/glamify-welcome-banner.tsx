import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles, Heart, ArrowRight } from "lucide-react";

export function GlamifyWelcomeBanner() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-pink-100/80 bg-gradient-to-b from-white via-pink-50/20 to-white p-8 sm:p-12 md:p-16 text-center shadow-soft-lg">
      {/* Elementos decorativos sutiles de fondo (estilo relieve / luxury embossed) */}
      <div className="pointer-events-none absolute -top-10 -left-10 size-48 rounded-full bg-pink-200/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -right-10 size-48 rounded-full bg-pink-300/20 blur-3xl" />

      {/* Contenido central */}
      <div className="relative z-10 mx-auto max-w-3xl space-y-6">
        {/* Estrella superior rosa */}
        <div className="flex justify-center">
          <Sparkles className="size-5 md:size-6 text-[#FF2E93] animate-pulse" aria-hidden="true" />
        </div>

        {/* Frase central */}
        <h1 className="space-y-1">
          <span className="block font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-[#161413] font-normal leading-tight">
            Decile{" "}
            <span className="font-display italic text-[#FF2E93] font-medium text-4xl sm:text-5xl md:text-6xl lg:text-7xl">
              ¡Hola!
            </span>
          </span>
          <span className="block font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-[#161413] font-normal leading-tight">
            a tu nuevo maquillaje favorito. <span className="inline-block hover:scale-125 transition-transform duration-200">💋</span>
          </span>
        </h1>

        {/* Botones de acción */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 sm:gap-4 pt-2">
          <Button
            asChild
            size="lg"
            className="bg-[#161413] text-white hover:bg-neutral-800 hover:scale-[1.02] active:scale-[0.98] rounded-2xl px-7 sm:px-8 py-6 text-sm font-semibold shadow-soft hover:shadow-soft-lg transition-all duration-200"
          >
            <Link href="/tienda" className="flex items-center gap-2">
              <span>Explorar Catálogo</span>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="bg-white/80 backdrop-blur-sm border-pink-200/80 hover:bg-pink-50/70 hover:border-pink-300 hover:scale-[1.02] active:scale-[0.98] rounded-2xl px-6 sm:px-7 py-6 text-sm font-semibold text-[#161413] shadow-soft hover:shadow-soft-lg transition-all duration-200"
          >
            <Link href="/tienda?filter=offers">Ver Novedades &amp; Ofertas</Link>
          </Button>
        </div>

        {/* Corazón inferior rosa */}
        <div className="pt-1 flex justify-center">
          <Heart className="size-5 sm:size-6 text-[#FF2E93] stroke-[1.75] fill-pink-50 hover:scale-125 transition-transform duration-200" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
