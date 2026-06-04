import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-border bg-surface-alt">
      <div className="container flex flex-col gap-4 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p className="font-display text-base text-primary">Glamify Makeup</p>
        <nav aria-label="Enlaces del pie">
          <ul className="flex flex-wrap gap-4">
            <li>
              <Link href="/tienda" className="hover:text-foreground">
                Tienda
              </Link>
            </li>
            <li>
              <span aria-disabled className="opacity-50">
                Nosotras
              </span>
            </li>
            <li>
              <span aria-disabled className="opacity-50">
                Términos
              </span>
            </li>
          </ul>
        </nav>
        <p>Medios de pago: próximamente</p>
      </div>
    </footer>
  );
}
