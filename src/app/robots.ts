import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/cuenta", "/checkout", "/api", "/ingresar"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
