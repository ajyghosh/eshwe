export type HomePageContent = {
  id?: string;
  heroImageUrl: string;
  heroImagePath?: string | null;
  heroImagePosition: string;
  launchEyebrow: string;
  launchHeading: string;
  launchBody: string;
  launchCardMaxWidth: number;
  launchImageUrl: string;
  launchImagePath?: string | null;
  launchImageAlt: string;
  launchImageLayout: "top" | "right" | "left";
  categoriesHeading: string;
  categoriesSubtitle: string;
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
  launchEyebrow: "OPENING SHORTLY",
  launchHeading: "We are currently in a soft launch preview.",
  launchBody:
    "The boutique is live for a trial run while we fine-tune the experience and curate the first collections.",
  launchCardMaxWidth: DEFAULT_HOME_LAUNCH_CARD_MAX_WIDTH,
  launchImageUrl: "",
  launchImagePath: "",
  launchImageAlt: "Soft launch promotion",
  launchImageLayout: "right",
  categoriesHeading: "",
  categoriesSubtitle: ""
};

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
