import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { StorefrontHomeContent } from "@/components/storefront-home-content";
import { StorefrontCatalogue } from "@/components/storefront-catalogue";

export default function Home() {
  const serviceHighlights = [
    {
      title: "Trendy Collections",
      description: "Stay ahead of fashion trends with our regularly updated collections.",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3 4.5 7v5c0 4.2 2.7 8 7.5 9 4.8-1 7.5-4.8 7.5-9V7L12 3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      )
    },
    {
      title: "Affordable Prices",
      description:
        "Enjoy stylish sarees without breaking the bank, with pieces curated at very approachable prices.",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3v18" />
          <path d="M16.5 7.5c0-1.7-1.9-3-4.5-3s-4.5 1.3-4.5 3 1.6 2.6 4.5 3 4.5 1.3 4.5 3-1.9 3-4.5 3-4.5-1.3-4.5-3" />
        </svg>
      )
    },
    {
      title: "Quality Assurance",
      description: "Every saree is selected to meet our standards for finish, feel, and lasting elegance.",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 4.5 14.3 9l5 .7-3.6 3.5.9 5-4.6-2.4-4.6 2.4.9-5L4.7 9.7l5-.7L12 4.5Z" />
        </svg>
      )
    },
    {
      title: "Secured Payments",
      description:
        "We accept major debit and credit cards, UPI, and net banking for a smooth checkout experience.",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3.5" y="6" width="17" height="12" rx="2.5" />
          <path d="M3.5 10h17" />
          <path d="M7.5 14.5h3" />
        </svg>
      )
    }
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fbf4e8] text-[#4f5942]">
      <StorefrontHeader absolute />

      <StorefrontHomeContent />

      <StorefrontCatalogue />

      <section className="relative overflow-hidden bg-[#5a6851] px-6 py-10 text-[#f8ecd2] sm:px-10 sm:py-12 lg:px-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,245,222,0.14),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(251,244,232,0.1),transparent_28%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(248,236,210,0.45),transparent)]" />

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <h2 className="brand-copy mx-auto max-w-2xl text-[1.7rem] leading-[1.2] text-[#f8ecd2] sm:text-[2rem] lg:text-[2.15rem]">
            A Boutique Where Every <span className="italic text-[#f3dfaa]">Saree</span> Feels
            {" "}
            Effortlessly <span className="italic text-[#f3dfaa]">Graceful</span> and Deeply
            {" "}
            <span className="italic text-[#f3dfaa]">Personal</span>
          </h2>

          <p className="mx-auto mt-3 max-w-2xl text-[0.92rem] leading-7 text-[#f8f1e3]/88 sm:text-[0.95rem] sm:leading-7">
            At eshwe, each drape is chosen for soft elegance, thoughtful detail, and a sense of occasion
            that still feels personal.
          </p>
        </div>
      </section>

      <section className="relative z-10 bg-[#fbf4e8] px-6 py-18 sm:px-10 sm:py-20 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="brand-copy text-2xl leading-tight text-[#3f4738] sm:text-3xl">
              Why Women Choose eshwe
            </h2>
            <p className="mt-3 text-sm text-[#667056] sm:text-base">
              Boutique selections with thoughtful pricing, quality, and ease.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {serviceHighlights.map((item) => (
              <article
                key={item.title}
                className="rounded-[1.5rem] border border-[#e4d8c7] bg-[#f8f0e3] p-6 shadow-[0_18px_45px_rgba(94,104,79,0.06)]"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#5e684f] text-[#fbf4e8]">
                  {item.icon}
                </span>
                <h3 className="brand-copy mt-5 text-xl text-[#3f4738]">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#667056]">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter homeHref="/" featuredHref="/shop/featured/" contactId="contact" />
    </main>
  );
}
