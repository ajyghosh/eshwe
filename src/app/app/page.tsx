import { MobileAppHomePage } from "@/components/mobile-app-pages";
import { homeMetadata } from "@/lib/home-metadata";

export const metadata = homeMetadata;

export default function MobileAppRoute() {
  return <MobileAppHomePage />;
}
