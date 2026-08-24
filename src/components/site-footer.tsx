import Link from "next/link";

type SiteFooterProps = {
  homeHref?: string;
  contactId?: string;
};

export function SiteFooter({
  homeHref = "/",
  contactId = "contact"
}: SiteFooterProps) {
  return (
    <footer
      id={contactId}
      className="relative overflow-hidden bg-[#5a6851] px-6 py-14 text-[#f8ecd2] sm:px-10 sm:py-16 lg:px-12"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,245,222,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(251,244,232,0.08),transparent_24%)]" />

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="grid gap-10 border-b border-[#f3dfaa]/20 pb-10 lg:grid-cols-[1.3fr_0.8fr_0.9fr] lg:gap-14">
          <div>
            <p className="brand-caption text-[0.64rem] font-semibold tracking-[0.22em] text-[#f3dfaa]">
              ESHWE SAREE STUDIO
            </p>
            <h2 className="brand-copy mt-4 max-w-md text-3xl leading-[1.15] text-[#f8ecd2] sm:text-[2.4rem]">
              Sarees chosen with softness, occasion, and timeless charm in mind.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-7 text-[#f8f1e3]/82 sm:text-[0.95rem]">
              Discover boutique drapes for celebrations, gifting, and everyday elegance, all curated
              to feel personal from the very first wear.
            </p>
          </div>

          <div>
            <h3 className="brand-copy text-xl text-[#f8ecd2]">Explore</h3>
            <nav className="mt-5 flex flex-col gap-3 text-sm text-[#f8f1e3]/82">
              <Link href={homeHref} className="transition-colors duration-300 hover:text-[#f3dfaa]">
                Home
              </Link>
              <Link href="/shop" className="transition-colors duration-300 hover:text-[#f3dfaa]">
                Categories
              </Link>
              <Link href="/shop" className="transition-colors duration-300 hover:text-[#f3dfaa]">
                Collections
              </Link>
              <Link href="/contact/" className="transition-colors duration-300 hover:text-[#f3dfaa]">
                Contact
              </Link>
            </nav>
          </div>

          <div>
            <h3 className="brand-copy text-xl text-[#f8ecd2]">Boutique Promise</h3>
            <div className="mt-5 space-y-4 text-sm leading-7 text-[#f8f1e3]/82">
              <p>Thoughtfully updated edits in mul cotton, tissue, and Kerala sarees.</p>
              <p>Secure checkout with cards, UPI, and net banking.</p>
              <p>Support for product queries, gifting picks, and occasion styling.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-6 text-xs text-[#f8f1e3]/68 sm:flex-row sm:items-center sm:justify-between sm:text-sm">
          <p>© 2026 eshwe Saree Studio. All rights reserved.</p>
          <p>Curated drapes for modern celebrations.</p>
        </div>
      </div>
    </footer>
  );
}
