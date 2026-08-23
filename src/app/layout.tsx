import type { Metadata } from "next";

import { StorefrontShell } from "@/components/storefront-shell";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://eshwe.com"),
  title: "eshwe",
  description:
    "eshwe Saree Studio is preparing a premium launch of curated sarees rooted in timeless craftsmanship and contemporary elegance.",
  keywords: [
    "eshwe",
    "eshwe saree studio",
    "saree studio",
    "premium sarees",
    "designer sarees",
    "Thrissur saree studio"
  ],
  alternates: {
    canonical: "/"
  },
  icons: {
    icon: [
      { url: "/favicon/favicon.ico", sizes: "any" },
      { url: "/favicon/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon/favicon-96x96.png", sizes: "96x96", type: "image/png" }
    ],
    apple: [{ url: "/favicon/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: ["/favicon/favicon.ico"]
  },
  manifest: "/favicon/site.webmanifest",
  openGraph: {
    title: "eshwe",
    description:
      "Launching soon: a refined saree studio bringing heirloom craftsmanship and modern elegance together.",
    url: "https://eshwe.com",
    siteName: "eshwe",
    locale: "en_IN",
    type: "website"
  },
  twitter: {
    card: "summary",
    title: "eshwe",
    description:
      "Launching soon: a refined saree studio bringing heirloom craftsmanship and modern elegance together."
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://firebasestorage.googleapis.com" crossOrigin="" />
        <link rel="preconnect" href="https://storage.googleapis.com" crossOrigin="" />
      </head>
      <body>
        <StorefrontShell>{children}</StorefrontShell>
      </body>
    </html>
  );
}
