/** Base pública de la app (back_urls, OG, sitemap). */
export function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/** Convierte un path relativo en URL absoluta; deja pasar las que ya son http(s). */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return new URL(path, appBaseUrl()).toString();
}
