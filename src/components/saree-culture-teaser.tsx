import Link from "next/link";

export function SareeCultureTeaser() {
  return (
    <section className="rounded-2xl border border-[#e3d8c9] bg-[#f8f0e3] px-5 py-7 sm:px-8 sm:py-9">
      <p className="brand-caption text-xs font-semibold uppercase tracking-[0.14em] text-[#657260]">The eshwe journal</p>
      <h2 className="brand-copy mt-3 text-2xl leading-tight text-[#354233] sm:text-3xl">A story in every saree</h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-[#626e58]">
        From Kerala kasavu and Onam traditions to everyday cotton and festive silk, explore the fabrics,
        regional styles and little details that make a drape your own.
      </p>
      <Link href="/saree-culture/" className="mt-4 inline-flex min-h-11 items-center gap-3 text-sm font-semibold text-[#4f5942] underline decoration-[#a6ac99] underline-offset-4">
        Explore saree culture <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
