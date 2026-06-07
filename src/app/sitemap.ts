import type { MetadataRoute } from "next";
import { getActiveProductSlugs, getCategoryTree } from "@/lib/catalog/queries";
import { absoluteUrl } from "@/lib/seo/url";

// La home/sitemap consultan la DB (Prisma); evitar prerender estático en el build de Workers.
export const dynamic = "force-dynamic";

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
