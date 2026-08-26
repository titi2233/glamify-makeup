import { Truck, CreditCard, Sparkles } from "lucide-react";

const PROPS = [
  {
    icon: Sparkles,
    title: "Fórmulas Clean & Cruelty Free",
    description: "Ingredientes testeados dermatológicamente, 100% libres de crueldad animal.",
  },
  {
    icon: Truck,
    title: "Envíos a Todo el País",
    description: "Seguimiento online en tiempo real y embalaje con protección premium.",
  },
  {
    icon: CreditCard,
    title: "3 Cuotas Sin Interés",
    description: "Pagá de forma segura con Mercado Pago y todas las tarjetas de crédito.",
  },
];

export function ValueProps() {
  return (
    <section className="rounded-3xl border border-border/80 bg-white/70 backdrop-blur-md p-6 md:p-8 shadow-soft">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 lg:grid-cols-3">
        {PROPS.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.title} className="flex items-start gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary/80 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h3 className="font-sans text-sm font-semibold text-foreground tracking-tight">
                  {p.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {p.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
