import type { MetadataRoute } from "next";
import { SITE_URL, sitemapEntries } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return sitemapEntries.map((entry) => ({
    url: entry.path === "/" ? SITE_URL : `${SITE_URL}${entry.path}`,
    lastModified,
    changeFrequency: entry.path === "/" ? "weekly" : "monthly",
    priority: entry.path === "/" ? 1 : entry.path.startsWith("/services") ? 0.9 : 0.8,
  }));
}
