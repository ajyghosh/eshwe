"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { MobileAppShell } from "@/components/mobile-app-shell";

export function MobileAppLegalPage({
  eyebrow,
  title,
  subtitle,
  children
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <MobileAppShell>
      <div className="px-4 pb-8 pt-[calc(env(safe-area-inset-top)+0.9rem)]">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e3d8c8] bg-white/80 text-[#2f342d] shadow-none"
          aria-label="Back"
        >
          <ArrowLeftIcon />
        </button>

        <section className="mobile-app-page-heading mt-4 border-b border-[#e8e3d9] pb-5">
          <p className="text-[0.74rem] font-semibold uppercase tracking-[0.22em] text-[#7d876f]">{eyebrow}</p>
          <h1 className="mt-2 text-[1.65rem] font-semibold leading-tight text-[#2f342d]">{title}</h1>
          <p className="mt-3 text-[0.95rem] leading-7 text-[#68735e]">{subtitle}</p>
        </section>

        <article className="mt-5 text-[0.94rem] leading-7 text-[#667056]">
          <div className="space-y-7">{children}</div>
        </article>
      </div>
    </MobileAppShell>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
      <path d="M8.2 12h8.3" />
    </svg>
  );
}
