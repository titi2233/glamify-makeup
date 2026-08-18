import { Sparkles, HelpCircle, FileText, Truck } from "lucide-react";

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

      {/* 2. Modo de Aplicación */}
      <details className="group py-3.5">
        <summary className="flex cursor-pointer list-none items-center justify-between font-sans text-sm font-semibold text-foreground select-none">
          <span className="flex items-center gap-2">
            <HelpCircle className="size-4 text-primary" />
            <span>Modo de Aplicación & Tips Pro</span>
          </span>
          <span className="text-muted-foreground transition-transform duration-200 group-open:rotate-180">
            ▼
          </span>
        </summary>
        <div className="mt-3 space-y-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          <p>
            <strong>Para un acabado sutil de día:</strong> Aplicá una pequeña cantidad sobre el dorso de la mano y difuminá con la yema de los dedos o brocha suave desde el centro hacia afuera.
          </p>
          <p>
            <strong>Para máxima intensidad o noche:</strong> Construí capas progresivas hasta lograr la cobertura y el tono deseado.
          </p>
        </div>
      </details>

      {/* 3. Ingredientes */}
      <details className="group py-3.5">
        <summary className="flex cursor-pointer list-none items-center justify-between font-sans text-sm font-semibold text-foreground select-none">
          <span className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            <span>Ingredientes & Transparencia</span>
          </span>
          <span className="text-muted-foreground transition-transform duration-200 group-open:rotate-180">
            ▼
          </span>
        </summary>
        <div className="mt-3 space-y-2 text-xs text-muted-foreground leading-relaxed">
          <p>
            Formulado sin parabenos, sulfatos ni ftalatos. Contiene micro-pigmentos minerales purificados, vitamina E y emolientes botánicos ligeros.
          </p>
          <p className="text-[11px] text-muted-foreground/80">
            Aprobado por ANMAT. Apto para todo tipo de pieles, incluidas las sensibles.
          </p>
        </div>
      </details>

      {/* 4. Envíos y Garantía */}
      <details className="group py-3.5">
        <summary className="flex cursor-pointer list-none items-center justify-between font-sans text-sm font-semibold text-foreground select-none">
          <span className="flex items-center gap-2">
            <Truck className="size-4 text-primary" />
            <span>Envíos, Medios de Pago & Cambios</span>
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
            <strong>Garantía de tono:</strong> Si al recibirlo notas que no es tu tono perfecto, te ayudamos a cambiarlo de inmediato.
          </p>
        </div>
      </details>
    </div>
  );
}
