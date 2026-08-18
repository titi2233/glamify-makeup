import Link from "next/link";
import { Sparkles, ArrowRight, Heart } from "lucide-react";

const LOOKS = [
  {
    id: "look-1",
    creator: "@camila.makeup",
    title: "Glass Skin Glow Look",
    shade: "Tono Golden Honey + Gloss Dew",
    image: "/images/ugc_glow_skin.jpg",
    likes: "2.4k",
  },
  {
    id: "look-2",
    creator: "@sofia.beauty",
    title: "Velvet Glaze Lip Tint",
    shade: "Labial Velvet Tono Crimson",
    image: "/images/ugc_lip_glow.jpg",
    likes: "1.8k",
  },
  {
    id: "look-3",
    creator: "@valen.glam",
    title: "Sunset Peach Dewy Blush",
    shade: "Rubor Crema Tono Nectar",
    image: "/images/ugc_blush_look.jpg",
    likes: "3.1k",
  },
  {
    id: "look-4",
    creator: "@marti.style",
    title: "Champagne Eyes Clean Look",
    shade: "Sombra Champagne + Mascara",
    image: "/images/ugc_eyes_look.jpg",
    likes: "4.2k",
  },
];

export function UgcReelsSection() {
  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary mb-1">
            <Sparkles className="size-3.5" />
            <span>#GlamifyCommunity</span>
          </div>
          <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-wider text-foreground">
            Inspiración & Looks Reales
          </h2>
          <p className="text-sm text-muted-foreground">
            Mirá cómo lucen nuestros tonos y texturas en la piel de nuestras clientas
          </p>
        </div>
        <Link
          href="/tienda"
          className="text-xs font-bold uppercase tracking-widest text-primary hover:underline inline-flex items-center gap-1"
        >
          <span>Explorar catálogo</span>
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {LOOKS.map((item) => (
          <div
            key={item.id}
            className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card shadow-soft transition-all duration-300 hover:shadow-soft-lg hover:-translate-y-1"
          >
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
              <img
                src={item.image}
                alt={item.title}
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
              
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-white text-[11px] font-medium">
                <Heart className="size-3 text-primary fill-primary" />
                <span>{item.likes}</span>
              </div>

              <div className="absolute bottom-0 inset-x-0 p-3.5 text-white space-y-1">
                <p className="text-[11px] font-medium text-white/80">{item.creator}</p>
                <h3 className="text-xs sm:text-sm font-bold leading-snug line-clamp-1">{item.title}</h3>
                <p className="text-[10px] text-white/70 truncate">{item.shade}</p>
                
                <div className="pt-1.5">
                  <Link
                    href="/tienda"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:text-white transition-colors"
                  >
                    <span>Shop the look</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
