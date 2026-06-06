import Link from "next/link";
import { businessInfo } from "@/lib/legal/business-info";

const linkClass =
  "inline-flex min-h-[44px] items-center hover:text-foreground focus-visible:outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring";

const columns: Array<{ title: string; links: Array<{ label: string; href: string; external?: boolean }> }> = [
  {
    title: "Tienda",
    links: [
      { label: "Tienda", href: "/tienda" },
      { label: "Nosotras", href: "/nosotras" },
    ],
  },
  {
    title: "Ayuda",
    links: [
      { label: "Contacto", href: "/contacto" },
      { label: "Preguntas frecuentes", href: "/preguntas-frecuentes" },
      { label: "Envíos y pagos", href: "/envios-y-pagos" },
    ],
  },
  {
    title: "Legales",
    links: [
      { label: "Términos y condiciones", href: "/terminos" },
      { label: "Política de privacidad", href: "/privacidad" },
      { label: "Botón de arrepentimiento", href: "/arrepentimiento" },
      { label: "Defensa del Consumidor", href: businessInfo.consumerDefenseUrl, external: true },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-border bg-surface-alt">
      <div className="container grid grid-cols-2 gap-6 py-10 text-sm text-muted-foreground md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <p className="font-display text-2xl text-primary">Glamify Makeup</p>
          <p className="mt-2 max-w-xs">Glam accesible, no humo. Maquillaje y accesorios con envíos a todo el país.</p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="mb-2 font-medium text-foreground">{col.title}</h2>
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
      <div className="container flex flex-col gap-2 border-t border-border py-4 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} Glamify Makeup. Todos los derechos reservados.</p>
        <p>Medios de pago: {businessInfo.paymentMethods}</p>
      </div>
    </footer>
  );
}
