"use client";

import type { ReactNode } from "react";

type OwnerSectionHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  aside?: ReactNode;
  className?: string;
};

export function OwnerSectionHero({
  eyebrow,
  title,
  description,
  action,
  aside,
  className = ""
}: OwnerSectionHeroProps) {
  return (
    <section
      className={`owner-section-header ${className}`}
    >
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <p className="brand-caption text-[0.68rem] font-semibold tracking-[0.22em] text-[#efe0b6]">
            {eyebrow}
          </p>
          <h1 className="brand-copy mt-2 text-3xl leading-tight">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#f8f1e3]/84 sm:text-[0.95rem]">
            {description}
          </p>
        </div>

        {aside ? <div className="xl:min-w-[320px]">{aside}</div> : null}
      </div>

      {action ? <div className="mt-8 flex flex-wrap gap-3">{action}</div> : null}
    </section>
  );
}
