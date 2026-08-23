import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://eshwe.com/",
      lastModified: "2026-08-06",
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: "https://eshwe.com/shop/",
      lastModified: "2026-08-21",
      changeFrequency: "weekly",
      priority: 0.9
    }
  ];
}
