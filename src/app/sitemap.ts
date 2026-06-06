import type { MetadataRoute } from "next";
import { getActiveProductSlugs, getCategoryTree } from "@/lib/catalog/queries";
import { absoluteUrl } from "@/lib/seo/url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [slugs, tree] = await Promise.all([getActiveProductSlugs(), getCategoryTree()]);
  const now = new Date();
  const categories = tree.flatMap((c) => [
    { url: absoluteUrl(`/tienda/${c.slug}`), lastModified: now },
    ...c.children.map((s) => ({ url: absoluteUrl(`/tienda/${c.slug}/${s.slug}`), lastModified: now })),
  ]);
  const staticPages = [
    "/terminos",
    "/privacidad",
    "/arrepentimiento",
    "/contacto",
    "/nosotras",
    "/preguntas-frecuentes",
    "/envios-y-pagos",
  ].map((p) => ({ url: absoluteUrl(p), lastModified: now }));
  return [
    { url: absoluteUrl("/"), lastModified: now },
    { url: absoluteUrl("/tienda"), lastModified: now },
    ...staticPages,
    ...categories,
    ...slugs.map((slug) => ({ url: absoluteUrl(`/producto/${slug}`), lastModified: now })),
  ];
}
