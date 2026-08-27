import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import type { Crumb } from "@/lib/catalog/categories";

export function CatalogBreadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((c, i) => (
          // BreadcrumbSeparator es un <li> — tiene que ser hermano de BreadcrumbItem (otro <li>),
          // no hijo: <li> anidado en <li> es HTML inválido y rompe la hidratación de React.
          <Fragment key={c.href}>
            <BreadcrumbItem>
              {c.current ? (
                <BreadcrumbPage className="line-clamp-1">{c.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href={c.href}>{c.label}</BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {i < items.length - 1 && <BreadcrumbSeparator />}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
