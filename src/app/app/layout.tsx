import type { Metadata, Viewport } from "next";

import { MobileAppPwaRegistration } from "@/components/mobile-app-pwa-registration";
import { MobileAppViewportBackground } from "@/components/mobile-app-viewport-background";

import "./mobile-app.css";

export const metadata: Metadata = {
  title: {
    default: "eshwe | Premium Saree Studio",
    template: "%s | eshwe"
  },
  applicationName: "eshwe",
  description: "A mobile-first Eshwe storefront designed to feel like a native saree shopping app.",
  alternates: {
    canonical: "/app/"
  },
  robots: {
    index: false,
    follow: true
  },
  appleWebApp: {
    capable: true,
    title: "eshwe",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  themeColor: "#fffaf2"
};

export default function MobileAppLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <MobileAppViewportBackground />
      <MobileAppPwaRegistration />
      {children}
    </>
  );
}
