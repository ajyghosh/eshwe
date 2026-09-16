export type AffordableBannerContent = {
  enabled: boolean;
  eyebrow: string;
  heading: string;
  body: string;
  buttonLabel: string;
  imageUrl: string;
  imagePath: string;
  imagePosition: string;
};

export const DEFAULT_AFFORDABLE_BANNER: AffordableBannerContent = {
  enabled: true,
  eyebrow: "Little everyday luxuries",
  heading: "Affordable Elegance",
  body: "Everyday favourites",
  buttonLabel: "Shop now",
  imageUrl: "/hero.webp",
  imagePath: "",
  imagePosition: "68% center"
};

export function normalizeAffordableBanner(value?: Partial<AffordableBannerContent> | null): AffordableBannerContent {
  const result = { ...DEFAULT_AFFORDABLE_BANNER };
  if (!value || typeof value !== "object") return result;
  result.enabled = value.enabled !== false;
  for (const key of ["eyebrow", "body"] as const) {
    if (typeof value[key] === "string") result[key] = value[key].trim().slice(0, 100);
  }
  for (const key of ["heading", "buttonLabel", "imageUrl", "imagePath", "imagePosition"] as const) {
    if (typeof value[key] === "string" && value[key].trim()) result[key] = value[key].trim();
  }
  result.heading = result.heading.slice(0, 60);
  result.buttonLabel = result.buttonLabel.slice(0, 24);
  return result;
}
