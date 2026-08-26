import { Sparkles, Truck } from "lucide-react";

interface PdpAccordionsProps {
  description?: string | null;
}

export function PdpAccordions({ description }: PdpAccordionsProps) {
  return (
    <div className="divide-y divide-border/80 border-y border-border/80 text-sm">
      {/* 1. Fórmula & Beneficios */}
      <details className="group py-3.5" open>
        <summary className="flex cursor-pointer list-none items-center justify-between font-sans text-sm font-semibold text-foreground select-none">
          <span className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <span>Fórmula & Beneficios Clave</span>
          </span>
          <span className="text-muted-foreground transition-transform duration-200 group-open:rotate-180">
            ▼
          </span>
        </summary>
        <div className="mt-3 space-y-2.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          <p>
            {description ||
              "Fórmula de alta fijación enriquecida con activos hidratantes para un acabado impecable, natural y de larga duración sin sensación pesada."}
          </p>
          <ul className="grid grid-cols-2 gap-1.5 pt-1 text-xs text-foreground font-medium">
            <li>✨ Acabado natural sedoso</li>
            <li>🌿 100% Cruelty-Free</li>
            <li>💧 Hidratación prolongada</li>
            <li>🧪 Hipoalergénico</li>
          </ul>
        </div>
      </details>

      {/* 2. Envíos y Medios de Pago */}
      <details className="group py-3.5">
        <summary className="flex cursor-pointer list-none items-center justify-between font-sans text-sm font-semibold text-foreground select-none">
          <span className="flex items-center gap-2">
            <Truck className="size-4 text-primary" />
            <span>Envíos & Medios de Pago</span>
          </span>
          <span className="text-muted-foreground transition-transform duration-200 group-open:rotate-180">
            ▼
          </span>
        </summary>
        <div className="mt-3 space-y-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          <p>
            <strong>Envío gratis:</strong> En compras superiores a $47.500 a cualquier punto del país vía Correo Argentino.
          </p>
          <p>
            <strong>Medios de pago:</strong> Hasta 3 cuotas sin interés con todas las tarjetas de crédito y débito a través de Mercado Pago.
          </p>
        </div>
      </details>
    </div>
  );
}
