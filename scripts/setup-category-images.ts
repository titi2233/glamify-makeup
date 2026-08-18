import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "fs";
import path from "path";

const BUCKET = "product-images";

const generatedFiles = {
  labios: "category_labios_realistic_1787004547767.jpg",
  ojos: "category_ojos_realistic_1787004563912.jpg",
  rostro: "category_rostro_realistic_1787004589899.jpg",
  accesorios: "category_accesorios_realistic_1787004652033.jpg",
};

const artifactDir = "C:\\Users\\Lazar\\.gemini\\antigravity-ide\\brain\\39e44d0a-b518-42ee-b363-58dfc83145e2";

async function main() {
  console.log("=== CONFIGURANDO IMÁGENES DE CATEGORÍAS ===");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  // 1. Copiar a public/images/
  const publicDir = path.resolve("public/images");
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  for (const [slug, fileName] of Object.entries(generatedFiles)) {
    const src = path.join(artifactDir, fileName);
    const destJpg = path.join(publicDir, `category_${slug}.jpg`);
    const destPng = path.join(publicDir, `category_${slug}.png`);

    if (fs.existsSync(src)) {
      fs.copyFileSync(src, destJpg);
      fs.copyFileSync(src, destPng);
      console.log(`[+] Copiado local a: public/images/category_${slug}.jpg y .png`);
    } else {
      console.error(`[-] Archivo no encontrado: ${src}`);
    }

    // 2. Subir a Supabase Storage
    const buffer = fs.readFileSync(src);
    const storagePath = `categories/category_${slug}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error(`[-] Error subiendo ${storagePath} a Supabase:`, uploadError);
    } else {
      console.log(`[+] Subido a Supabase Storage: ${storagePath}`);
    }

    // 3. Actualizar categoría en Prisma DB
    await prisma.category.updateMany({
      where: { slug },
      data: {
        image: storagePath,
      },
    });
    console.log(`[+] Actualizada categoría '${slug}' en DB con image: ${storagePath}`);
  }

  await prisma.$disconnect();
  console.log("=== ¡IMÁGENES DE CATEGORÍA CONFIGURADAS CON ÉXITO! ===");
}

main().catch(console.error);
