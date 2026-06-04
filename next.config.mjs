import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
