import type { Metadata } from "next";
import { parseProductListParams } from "@/lib/catalog/filters";
import { getProductList } from "@/lib/catalog/queries";
import { ProductListView } from "@/components/catalog/product-list-view";

export const metadata: Metadata = {
  title: "Tienda — Glamify Makeup",
  description: "Explorá todo el catálogo de maquillaje y accesorios.",
};

export default async function TiendaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseProductListParams(await searchParams);
  const result = await getProductList(params, null);
  return <ProductListView title="Tienda" result={result} />;
}
