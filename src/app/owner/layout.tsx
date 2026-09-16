import type { Metadata } from "next";
import type { ReactNode } from "react";
import { OwnerActivityProvider } from "@/components/owner-activity-provider";

import "./owner-backoffice.css";

export const metadata: Metadata = {
  title: "Owner",
  robots: {
    index: false,
    follow: false
  }
};

export default function OwnerLayout({ children }: { children: ReactNode }) {
  return <div className="owner-workspace"><OwnerActivityProvider>{children}</OwnerActivityProvider></div>;
}
