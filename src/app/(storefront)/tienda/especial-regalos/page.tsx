import type { Metadata } from "next";
import { parseProductListParams, PAGE_SIZE } from "@/lib/catalog/filters";
import { getProductList, getCategoryTree, type ProductListResult } from "@/lib/catalog/queries";
import { ProductListView } from "@/components/catalog/product-list-view";
import { CatalogBreadcrumbs } from "@/components/catalog/catalog-breadcrumbs";

/** Slugs reales de las 4 categorías de regalo (creadas en /admin/categorias con showInMenu apagado). */
const GIFT_SLUGS = ["lip-combos", "gift-cards", "ramos-maquillaje", "box-maquillaje"];

export const metadata: Metadata = {
  title: "Especial Regalos",
  description: "Todas las opciones para regalar: Lip Combos, Gift Cards, Ramos y Box de Maquillaje.",
};

export default async function EspecialRegalosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tree = await getCategoryTree();
  const categoryIds = tree.filter((c) => GIFT_SLUGS.includes(c.slug)).map((c) => c.id);

  const listParams = parseProductListParams(await searchParams);
  // Ojo: `categoryIds: null` en getProductList significa "sin filtro" (catálogo completo). Si las 4
  // categorías de regalo todavía no fueron creadas en /admin/categorias, esta página debe mostrar
  // vacío, nunca el catálogo entero.
  const result: ProductListResult =
    categoryIds.length > 0
      ? await getProductList(listParams, categoryIds)
      : { items: [], total: 0, page: listParams.page, pageSize: PAGE_SIZE, totalPages: 1 };

  const crumbs = [
    { label: "Inicio", href: "/", current: false },
    { label: "Tienda", href: "/tienda", current: false },
    { label: "Especial Regalos", href: "/tienda/especial-regalos", current: true },
  ];

  return (
    <div className="space-y-4">
      <CatalogBreadcrumbs items={crumbs} />
      <ProductListView title="Especial Regalos" result={result} />
    </div>
  );
}
