import { Sparkles, Heart } from "lucide-react";

export function GlamifyWelcomeBanner() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-pink-100/80 bg-gradient-to-b from-white via-pink-50/20 to-white p-8 sm:p-12 md:p-16 text-center shadow-soft-lg">
      {/* Elementos decorativos sutiles de fondo (estilo relieve / luxury embossed) */}
      <div className="pointer-events-none absolute -top-10 -left-10 size-48 rounded-full bg-pink-200/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -right-10 size-48 rounded-full bg-pink-300/20 blur-3xl" />

      {/* Marca de agua decorativa sutil */}
      <div className="relative z-10 mx-auto max-w-3xl space-y-4">
        {/* Estrella superior rosa */}
        <div className="flex justify-center">
          <Sparkles className="size-5 md:size-6 text-[#FF2E93] animate-pulse" aria-hidden="true" />
        </div>

        {/* GLAMIFY */}
        <div className="space-y-1">
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-[0.35em] sm:tracking-[0.45em] text-[#161413] uppercase pl-[0.35em]">
            GLAMIFY
          </h2>
          {/* MAKEUP */}
          <p className="text-xs sm:text-sm md:text-base font-bold tracking-[0.45em] sm:tracking-[0.6em] text-[#FF2E93] uppercase pl-[0.45em]">
            MAKEUP
          </p>
        </div>

        {/* Separador fino con estrella central */}
        <div className="flex items-center justify-center gap-3 w-40 sm:w-56 mx-auto py-1 text-pink-300">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-pink-300" />
          <span className="text-[#FF2E93] text-xs">✦</span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-pink-300" />
        </div>

        {/* Frase central */}
        <div className="space-y-1 pt-1">
          <p className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-[#161413] font-normal leading-tight">
            Decile{" "}
            <span className="font-display italic text-[#FF2E93] font-medium text-4xl sm:text-5xl md:text-6xl lg:text-7xl">
              ¡Hola!
            </span>
          </p>
          <p className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-[#161413] font-normal leading-tight">
            a tu nuevo maquillaje favorito. <span className="inline-block hover:scale-125 transition-transform duration-200">💋</span>
          </p>
        </div>

        {/* Corazón inferior rosa */}
        <div className="pt-2 flex justify-center">
          <Heart className="size-5 sm:size-6 text-[#FF2E93] stroke-[1.75] fill-pink-50" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
