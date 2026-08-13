import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const PRODUCT_IMAGES_BUCKET = "product-images";

const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "image/avif"];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB, igual al límite del bucket

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
};

export interface UploadResult {
  path: string;
}

/**
 * Sube un archivo al bucket `product-images` con service-role y devuelve el path guardado.
 * Valida tipo y tamaño. El path es estable (uuid) para guardarlo en `product.images[]`
 * o `variant.image`.
 */
export async function uploadProductImage(file: File): Promise<UploadResult> {
  if (!ALLOWED_MIME.includes(file.type)) {
    throw new Error("Formato no permitido. Subí PNG, JPG, WEBP o AVIF.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("La imagen supera el límite de 5 MB.");
  }

  const ext = EXT_BY_MIME[file.type];
  const path = `products/${crypto.randomUUID()}.${ext}`;

  const supabase = createAdminClient();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) throw new Error(`No se pudo subir la imagen: ${error.message}`);

  return { path };
}
