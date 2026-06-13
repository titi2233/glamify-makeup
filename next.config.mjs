import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@prisma/client", ".prisma/client", "@prisma/adapter-pg", "pg"],
  experimental: {
    // El uploader de imágenes acepta archivos de hasta 5 MB (lib/admin/products/images.ts).
    // El default de Server Actions es 1 MB → subir una foto >1 MB tiraba una excepción
    // full-page antes de entrar al handler. 6 MB = 5 MB + margen para el sobre multipart.
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  images: {
    remotePatterns: [
      // Supabase Storage público (host real se setea por env en M1)
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;

// Habilita getCloudflareContext() durante `next dev` (no-op fuera de dev).
initOpenNextCloudflareForDev();
