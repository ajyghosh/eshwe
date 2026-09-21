import type { Metadata } from "next";

const title = "Sarees Online | Cotton, Soft Silk & Tissue Sarees | eshwe";
const description = "Explore sarees at eshwe studio: mul cotton, Kanchi cotton, Sungudi cotton, soft silk and tissue silk. Discover saree styles, culture and everyday favourites.";

// The mobile homepage is an alternate presentation of the same storefront.
// It must not inherit the noindex rule used for the other PWA screens.
export const homeMetadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title,
    description,
    url: "https://eshwe.com/",
    type: "website",
    images: [{ url: "/hero.webp", width: 1536, height: 1024, alt: "Saree styles at eshwe studio" }]
  },
  twitter: { card: "summary_large_image", title, description, images: ["/hero.webp"] }
};
