import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://eshwesareestudio.web.app",
      lastModified: "2026-08-06",
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: "https://eshwesareestudio.web.app/shop",
      lastModified: "2026-08-21",
      changeFrequency: "weekly",
      priority: 0.9
    }
  ];
}
