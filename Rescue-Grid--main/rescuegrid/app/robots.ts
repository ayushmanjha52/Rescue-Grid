import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/volunteer/login"],
      // Private areas and per-report links must never show up in search results.
      disallow: ["/dma", "/volunteer/", "/report/status/", "/report/my", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
