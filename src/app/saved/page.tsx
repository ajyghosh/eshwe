import type { Metadata } from "next";

import { SavedPiecesPage } from "@/components/saved-pieces-page";

export const metadata: Metadata = {
  title: "Saved Pieces",
  description: "View your saved Eshwe pieces.",
  alternates: { canonical: "/saved/" },
  robots: { index: false, follow: false }
};

export default function SavedRoute() {
  return <SavedPiecesPage />;
}
