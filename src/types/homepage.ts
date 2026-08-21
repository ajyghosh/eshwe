export type HomePageContent = {
  id?: string;
  heroImageUrl: string;
  heroImagePath?: string | null;
  heroImagePosition: string;
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
