/**
 * Crea el bucket de Storage `product-images` en Supabase (idempotente).
 * Script standalone (corre con tsx, fuera de Next) → cliente self-contained
 * para evitar alias `@` y `server-only`. Requiere en el entorno:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";

const BUCKET = "product-images";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: buckets, error: listErr } =
    await supabase.storage.listBuckets();
  if (listErr) throw listErr;

  if (buckets?.some((b) => b.name === BUCKET)) {
    console.log(`Bucket "${BUCKET}" ya existe — nada que hacer.`);
    return;
  }

  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: "5MB",
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/avif"],
  });
  if (error) throw error;
  console.log(`Bucket "${BUCKET}" creado (público, imágenes).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
