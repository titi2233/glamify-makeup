import Link from "next/link";
import { Sparkles, ArrowRight, Gift, Heart, Package, Flower2 } from "lucide-react";

interface GiftItem {
  id: string;
  title: string;
  badge: string;
  description: string;
  href: string;
  icon: typeof Gift;
  image?: string;
  gradient: string;
}

const GIFT_ITEMS: GiftItem[] = [
  {
    id: "lip-combos",
    title: "Lip Combo's",
    badge: "Tendencia Viral 🔥",
    description: "Combinaciones exclusivas de delineador, labial y gloss para un acabado profesional y jugoso.",
    href: "/tienda/labios",
    icon: Sparkles,
    image: "/images/product_lipstick.png",
    gradient: "from-rose-500/10 to-pink-500/5",
  },
  {
    id: "gift-cards",
    title: "Gift Cards",
    badge: "Regalo Seguro 🎀",
    description: "La tarjeta de regalo perfecta para que esa persona especial elija sus productos favoritos.",
    href: "/tienda",
    icon: Gift,
    image: "/images/exit_modal_visual.jpg",
    gradient: "from-purple-500/10 to-pink-500/5",
  },
  {
    id: "ramos-maquillaje",
    title: "Ramos de Maquillaje",
    badge: "El Más Elegido 💐",
    description: "Presentaciones tipo ramo súper originales armadas con los mejores cosméticos y detalles girly.",
    href: "/tienda",
    icon: Flower2,
    image: "/images/hero_editorial_glow.jpg",
    gradient: "from-amber-500/10 to-rose-500/5",
  },
  {
    id: "box-maquillaje",
    title: "Box de Maquillaje",
    badge: "Set Completo ✨",
    description: "Cajas temáticas con mix de productos seleccionados para armar looks deslumbrantes.",
    href: "/tienda",
    icon: Package,
    image: "/images/product_brushes.png",
    gradient: "from-pink-500/10 to-rose-500/5",
  },
];

export function GiftSection() {
  return (
    <section className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#FF2E93] mb-1.5">
            <Heart className="size-3.5 fill-[#FF2E93]" />
            <span>Especial Regalos</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold uppercase tracking-wider text-foreground">
            Regalá beauty, regalá Glamify 💗
          </h2>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Sorprendé a quien más querés con los detalles más lindos y especiales
          </p>
        </div>
        <Link
          href="/tienda"
          className="text-xs font-bold uppercase tracking-widest text-primary hover:underline inline-flex items-center gap-1 shrink-0"
        >
          <span>Ver todas las opciones</span>
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {GIFT_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border/80 bg-white/90 p-6 shadow-soft transition-all duration-300 hover:shadow-soft-lg hover:-translate-y-1 hover:border-[#FF2E93]/40"
            >
              {/* Fondo suave con degradé */}
              <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-60 group-hover:opacity-100 transition-opacity`} />

              <div className="relative z-10 space-y-4">
                {/* Header de la tarjeta */}
                <div className="flex items-center justify-between">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-white shadow-soft text-[#FF2E93] border border-pink-100 group-hover:scale-110 transition-transform duration-300">
                    <Icon className="size-5" />
                  </div>
                  <span className="inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/90 text-foreground/80 border border-border/60 shadow-xs">
                    {item.badge}
                  </span>
                </div>

                {/* Título y descripción */}
                <div className="space-y-1.5">
                  <h3 className="font-display text-xl font-bold text-foreground group-hover:text-[#FF2E93] transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>

              {/* Botón de acción inferior */}
              <div className="relative z-10 pt-5 mt-auto flex items-center gap-1 text-xs font-bold text-primary group-hover:text-foreground transition-colors">
                <span>Ver opciones</span>
                <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
