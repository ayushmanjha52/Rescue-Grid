import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import { SITUATIONS } from "@/lib/status";

// Only public pages. Dashboards and per-report links are excluded (see robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    ...SITUATIONS.map((type) => ({
      url: `${SITE_URL}/report/${type}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: `${SITE_URL}/volunteer/login`, changeFrequency: "monthly", priority: 0.6 },
  ];
}
