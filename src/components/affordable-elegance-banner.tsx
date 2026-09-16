import Image from "next/image";
import Link from "next/link";

import { normalizeAffordableBanner, type AffordableBannerContent } from "@/types/affordable-banner";

export function AffordableEleganceBanner({ href, content }: { href: string; content?: Partial<AffordableBannerContent> | null }) {
  const banner = normalizeAffordableBanner(content);
  if (!banner.enabled) return null;
  return (
    <Link
      href={href}
      className="group relative grid grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] overflow-hidden rounded-2xl border border-[#dcd8c7] bg-[#edf0e5] text-[#354233] transition-colors hover:bg-[#e6ebdc] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5e684f] sm:grid-cols-[1fr_1fr]"
    >
      <div className="relative z-10 flex min-w-0 break-words flex-col items-start justify-center px-4 py-6 sm:px-8 sm:py-9 lg:px-12 lg:py-12">
        <p className="brand-caption text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-[#5e684f] sm:text-xs">{banner.eyebrow}</p>
        <h2 className="brand-copy mt-2 text-[1.6rem] leading-[1.1] sm:text-4xl lg:text-5xl">{banner.heading}</h2>
        <p className="mt-3 text-[0.82rem] leading-5 text-[#526049] sm:text-base">{banner.body}</p>
        <p className="mt-1 text-lg font-semibold tracking-tight sm:text-2xl">₹399–₹999</p>
        <span className="mt-4 inline-flex min-h-11 items-center gap-3 rounded-xl bg-[#5e684f] px-4 py-2 text-xs font-semibold text-[#fbf4e8] sm:mt-6 sm:px-5 sm:text-sm">
          {banner.buttonLabel} <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
        </span>
      </div>
      <div className="relative min-h-full overflow-hidden bg-[#e8dcc8]">
        <Image src={banner.imageUrl} alt="" fill sizes="(max-width: 640px) 40vw, (max-width: 1280px) 50vw, 640px" className="object-cover" style={{ objectPosition: banner.imagePosition }} />
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(237,240,229,0.25),transparent_45%)]" />
      </div>
    </Link>
  );
}
