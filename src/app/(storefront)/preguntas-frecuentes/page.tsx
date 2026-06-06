import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

export const metadata: Metadata = {
  title: "Preguntas frecuentes",
  description: "Dudas sobre envíos, pagos, cambios y devoluciones en Glamify Makeup.",
};

const faqs: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: "¿Hacen envíos a todo el país?",
    a: (
      <>
        Sí, enviamos a toda la Argentina por Correo Argentino (a domicilio o sucursal). Mirá zonas, costos y plazos
        en <Link href="/envios-y-pagos">Envíos y pagos</Link>.
      </>
    ),
  },
  {
    q: "¿Cuánto tarda en llegar mi pedido?",
    a: "Despachamos dentro de las 24 a 72 horas hábiles de acreditado el pago. El tiempo de tránsito depende de tu zona; el seguimiento te llega por email.",
  },
  {
    q: "¿Qué medios de pago aceptan?",
    a: "Pagás de forma segura con Mercado Pago: tarjetas de crédito/débito y dinero en cuenta. No guardamos los datos de tu tarjeta.",
  },
  {
    q: "¿Puedo cambiar o devolver un producto?",
    a: (
      <>
        Sí. Tenés derecho de arrepentimiento por 10 días corridos (art. 34 Ley 24.240): gestionalo desde el{" "}
        <Link href="/arrepentimiento">Botón de Arrepentimiento</Link>. Para cambios por defecto, escribinos por{" "}
        <Link href="/contacto">contacto</Link>.
      </>
    ),
  },
  {
    q: "¿El stock es real?",
    a: "Sí. Lo que ves disponible es lo que tenemos; cuando queda poco, te lo mostramos en la ficha del producto.",
  },
  {
    q: "¿Cómo sé si un tono me queda?",
    a: "Las fotos son lo más fieles posible, pero el tono puede variar según tu pantalla. Si tenés dudas, escribinos y te asesoramos antes de comprar.",
  },
];

export default function FaqPage() {
  return (
    <section className="mx-auto max-w-prose space-y-6 py-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold">Preguntas frecuentes</h1>
        <p className="text-foreground/90">Respuestas rápidas a las consultas más comunes.</p>
      </header>

      <div className="space-y-3">
        {faqs.map((f) => (
          <details key={f.q} className="group rounded-2xl border border-border p-4">
            <summary className="flex cursor-pointer items-center justify-between gap-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span>{f.q}</span>
              <ChevronDown className="h-5 w-5 shrink-0 transition group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
            </summary>
            <div className="mt-2 text-sm leading-relaxed text-foreground/90 [&_a]:text-primary-hover [&_a]:underline">
              {f.a}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
