/**
 * URL pública de una imagen de producto/combo/variante a partir del path guardado en DB.
 *
 * En DB se guarda solo el path del objeto (ej. `products/uuid.jpg`), no la URL completa
 * (ver lib/admin/products/images.ts). Para renderizarla en el storefront hay que
 * anteponerle la base pública del bucket. Función pura y client-safe (lee la env
 * NEXT_PUBLIC_, que Next inlinea en el bundle).
 *
 * - Devuelve `null` si no hay path.
 * - Si el valor ya es una URL absoluta (http/https), la devuelve tal cual.
 * - Si es un path estático local (`/images/...`), lo devuelve tal cual.
 */
const PRODUCT_IMAGES_BUCKET = "product-images";

/** Base pública del bucket de imágenes de producto (con barra final), o "" sin env configurada. */
export function productImagesPublicBase(): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return base ? `${base}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/` : "";
}

export function productImageUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/images/")) return path;
  const base = productImagesPublicBase();
  if (!base) return null;
  return `${base}${path.replace(/^\//, "")}`;
}
