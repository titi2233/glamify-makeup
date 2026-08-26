import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { businessInfo } from "@/lib/legal/business-info";

const linkClass =
  "inline-flex min-h-[38px] items-center text-sm text-muted-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring";

const columns: Array<{ title: string; links: Array<{ label: string; href: string; external?: boolean }> }> = [
  {
    title: "Tienda",
    links: [
      { label: "Catálogo Completo", href: "/tienda" },
      { label: "Sobre Nosotras", href: "/nosotras" },
    ],
  },
  {
    title: "Ayuda",
    links: [
      { label: "Contacto", href: "/contacto" },
      { label: "Preguntas Frecuentes", href: "/preguntas-frecuentes" },
      { label: "Envíos y Pagos", href: "/envios-y-pagos" },
    ],
  },
  {
    title: "Legales",
    links: [
      { label: "Términos y Condiciones", href: "/terminos" },
      { label: "Política de Privacidad", href: "/privacidad" },
      { label: "Botón de Arrepentimiento", href: "/arrepentimiento" },
      { label: "Defensa del Consumidor", href: businessInfo.consumerDefenseUrl, external: true },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border/80 bg-white/95 backdrop-blur-md">
      <div className="container grid grid-cols-2 gap-8 py-12 text-sm text-muted-foreground md:grid-cols-4">
        <div className="col-span-2 md:col-span-1 space-y-3">
          <div className="inline-block">
            <Logo size="sm" />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
            Envíos seguros a todo el país. Los mejores productos y tendencias para resaltar tu belleza.
          </p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-foreground">{col.title}</h2>
            <ul className="space-y-1">
              {col.links.map((link) => (
                <li key={link.label}>
                  {link.external ? (
                    <a href={link.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className={linkClass}>
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="container flex flex-col gap-2 border-t border-border/60 py-5 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} Glamify Makeup. Todos los derechos reservados.</p>
        <p>Medios de pago: {businessInfo.paymentMethods}</p>
      </div>
    </footer>
  );
}
