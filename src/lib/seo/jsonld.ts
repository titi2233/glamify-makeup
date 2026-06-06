/** Datos estructurados schema.org (JSON-LD) — puros, sin I/O. */

export interface ProductLdInput {
  name: string;
  description: string | null;
  images: string[];
  sku?: string | null;
  price: number;
  inStock: boolean;
  url: string;
  brand?: string;
}

export interface ProductJsonLd {
  "@context": string;
  "@type": string;
  name: string;
  image: string[];
  offers: { "@type": string; price: string; priceCurrency: string; availability: string; url: string };
  aggregateRating?: { "@type": string; ratingValue: number; reviewCount: number };
  [key: string]: unknown;
}

/** Product + Offer (ARS) + AggregateRating (solo si hay reseñas). */
export function buildProductJsonLd(p: ProductLdInput, rating: { average: number; count: number }): ProductJsonLd {
  const ld: ProductJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    image: p.images,
    brand: { "@type": "Brand", name: p.brand ?? "Glamify Makeup" },
    offers: {
      "@type": "Offer",
      price: p.price.toFixed(2),
      priceCurrency: "ARS",
      availability: `https://schema.org/${p.inStock ? "InStock" : "OutOfStock"}`,
      url: p.url,
    },
  };
  if (p.description) ld.description = p.description;
  if (p.sku) ld.sku = p.sku;
  if (rating.count > 0) {
    ld.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Math.round(rating.average * 10) / 10,
      reviewCount: rating.count,
    };
  }
  return ld;
}

/** Serializa JSON-LD para inyectar en <script>, escapando `<` (evita romper la etiqueta). */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function buildWebSiteJsonLd(url: string) {
  return { "@context": "https://schema.org", "@type": "WebSite", name: "Glamify Makeup", url };
}

export function buildOrganizationJsonLd(url: string) {
  return { "@context": "https://schema.org", "@type": "Organization", name: "Glamify Makeup", url };
}
