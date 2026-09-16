import { MobileAppHomePage } from "@/components/mobile-app-pages";
import { homeMetadata } from "@/lib/home-metadata";
import { publishedCatalogue } from "@/lib/server-catalogue";

export const metadata = homeMetadata;

export default function MobileAppRoute() {
  // Reserve the same rows as the initial live query, without exposing stale prices or stock.
  const homeProducts = publishedCatalogue()
    .filter(product => product.createdAt)
    .sort((left, right) => Date.parse(right.createdAt!) - Date.parse(left.createdAt!))
    .slice(0, 18);

  return <MobileAppHomePage initialPreviewCounts={{
    arrivals: Math.min(homeProducts.length, 4),
    featured: Math.min(homeProducts.filter(product => product.featured).length, 4)
  }} />;
}
