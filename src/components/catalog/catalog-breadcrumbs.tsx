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
          <BreadcrumbItem key={c.href}>
            {c.current ? (
              <BreadcrumbPage className="line-clamp-1">{c.label}</BreadcrumbPage>
            ) : (
              <BreadcrumbLink href={c.href}>{c.label}</BreadcrumbLink>
            )}
            {i < items.length - 1 && <BreadcrumbSeparator />}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
