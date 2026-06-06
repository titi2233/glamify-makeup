import { describe, it, expect } from "vitest";
import { buildProductJsonLd, serializeJsonLd } from "@/lib/seo/jsonld";

describe("buildProductJsonLd", () => {
  const base = {
    name: "Labial Rojo",
    description: "Mate",
    images: ["https://x/1.jpg"],
    sku: "LAB-0001",
    price: 5000,
    inStock: true,
    url: "https://glamify/producto/labial-rojo",
  };

  it("incluye Offer con precio ARS y availability InStock", () => {
    const ld = buildProductJsonLd(base, { average: 0, count: 0 });
    expect(ld["@type"]).toBe("Product");
    expect(ld.offers.priceCurrency).toBe("ARS");
    expect(ld.offers.price).toBe("5000.00");
    expect(ld.offers.availability).toContain("InStock");
    expect(ld.aggregateRating).toBeUndefined();
  });

  it("agrega aggregateRating sólo si hay reseñas (ratingValue redondeado)", () => {
    const ld = buildProductJsonLd(base, { average: 4.46, count: 3 });
    expect(ld.aggregateRating).toEqual({ "@type": "AggregateRating", ratingValue: 4.5, reviewCount: 3 });
  });

  it("OutOfStock cuando inStock=false", () => {
    const ld = buildProductJsonLd({ ...base, inStock: false }, { average: 0, count: 0 });
    expect(ld.offers.availability).toContain("OutOfStock");
  });
});

describe("serializeJsonLd", () => {
  it("escapa '<' para no romper la etiqueta <script>", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c");
  });
});
