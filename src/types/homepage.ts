import type { AffordableBannerContent } from "@/types/affordable-banner";

export type MobileHomeHeroSlide = {
  imageUrl: string;
  imagePath?: string | null;
  imageAlt?: string | null;
  position?: string | null;
};

export type HomePageContent = {
  affordableBanner?: AffordableBannerContent;
  id?: string;
  heroImageUrl: string;
  heroImagePath?: string | null;
  heroImagePosition: string;
  launchEyebrow: string;
  launchHeading: string;
  launchBody: string;
  mobileLaunchEyebrow: string;
  mobileLaunchHeading: string;
  mobileLaunchBody: string;
  mobileLaunchButtonLabel: string;
  mobileLaunchButtonHref: string;
  launchCardMaxWidth: number;
  launchImageUrl: string;
  launchImagePath?: string | null;
  launchImageAlt: string;
  launchImageLayout: "top" | "right" | "left";
  categoriesHeading: string;
  categoriesSubtitle: string;
  desktopHeroSlides: MobileHomeHeroSlide[];
  mobileHeroSlides: MobileHomeHeroSlide[];
  updatedAt?: unknown;
};

export type CategoryCard = {
  id?: string;
  title: string;
  imageUrl: string;
  imagePath?: string | null;
  shopFilter?: string | null;
  backgroundPosition: string;
  active: boolean;
  sortOrder: number;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export const DEFAULT_HOME_LAUNCH_CARD_MAX_WIDTH = 460;

export const DEFAULT_HOME_PAGE_CONTENT: HomePageContent = {
  heroImageUrl: "",
  heroImagePath: "",
  heroImagePosition: "center",
  launchEyebrow: "THE ESHWE COLLECTION",
  launchHeading: "Timeless sarees, thoughtfully yours.",
  launchBody:
    "Discover handpicked sarees for everyday elegance, meaningful gifts and special celebrations.",
  mobileLaunchEyebrow: "THE ESHWE COLLECTION",
  mobileLaunchHeading: "Timeless sarees, thoughtfully yours.",
  mobileLaunchBody:
    "Handpicked drapes in mul cotton, tissue and more. Soft on you, perfect for every occasion.",
  mobileLaunchButtonLabel: "SHOP SAREES",
  mobileLaunchButtonHref: "/app/search/",
  launchCardMaxWidth: DEFAULT_HOME_LAUNCH_CARD_MAX_WIDTH,
  launchImageUrl: "",
  launchImagePath: "",
  launchImageAlt: "The eshwe saree collection",
  launchImageLayout: "right",
  categoriesHeading: "",
  categoriesSubtitle: "",
  desktopHeroSlides: [],
  mobileHeroSlides: []
};

// Retire only the original preview copy, including previously saved defaults.
// Custom owner copy continues to take precedence and the record is untouched.
export function normalizeHomeLaunchContent(content: HomePageContent): HomePageContent {
  const legacy = new Set([
    "opening shortly",
    "we are currently in a soft launch preview.",
    "the boutique is live for a trial run while we fine-tune the experience and curate the first collections.",
    "soft launch promotion"
  ]);
  const next = { ...content };
  for (const key of ["launchEyebrow", "launchHeading", "launchBody", "mobileLaunchEyebrow", "mobileLaunchHeading", "mobileLaunchBody", "launchImageAlt"] as const) {
    if (legacy.has(next[key]?.trim().toLowerCase())) next[key] = DEFAULT_HOME_PAGE_CONTENT[key];
  }
  if (next.mobileLaunchHeading?.trim() === "Timeless Sarees, thoughtfully yours") {
    next.mobileLaunchHeading = DEFAULT_HOME_PAGE_CONTENT.mobileLaunchHeading;
  }
  return next;
}

export function normalizeMobileHomeHeroSlides(value: unknown): MobileHomeHeroSlide[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const slides: MobileHomeHeroSlide[] = [];

  value.forEach((entry) => {
      if (!entry || typeof entry !== "object") {
        return;
      }

      const nextEntry = entry as Record<string, unknown>;
      const imageUrl = typeof nextEntry.imageUrl === "string" ? nextEntry.imageUrl.trim() : "";

      if (!imageUrl) {
        return;
      }

      slides.push({
        imageUrl,
        imagePath: typeof nextEntry.imagePath === "string" ? nextEntry.imagePath : "",
        imageAlt: typeof nextEntry.imageAlt === "string" ? nextEntry.imageAlt : "",
        position: typeof nextEntry.position === "string" ? nextEntry.position : "center"
      });
  });

  return slides.slice(0, 6);
}

export function normalizeHomeLaunchCardMaxWidth(value: number | string | null | undefined) {
  const parsedValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_HOME_LAUNCH_CARD_MAX_WIDTH;
  }

  return Math.min(880, Math.max(360, parsedValue));
}
