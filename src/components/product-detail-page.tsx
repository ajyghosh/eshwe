"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useCart } from "@/components/cart-provider";
import { CatalogueProductCard, EmptyCatalogueState } from "@/components/catalogue-product-card";
import { ProductCardCarousel } from "@/components/product-card-carousel";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import {
  defaultDryingTips,
  defaultProductLength,
  defaultProductNote,
  defaultSareeCareTips,
  defaultWashCare
} from "@/lib/product-detail-defaults";
import { subscribeToSarees } from "@/lib/sarees";
import {
  buildProductDetailPath,
  buildShopHref,
  resolveProductSlug
} from "@/lib/storefront-routes";
import type { Saree } from "@/types/saree";

export function ProductDetailPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchSlug = searchParams.get("slug");
  const { addItem, items, updateQuantity } = useCart();
  const [products, setProducts] = useState<Saree[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [currentUrl, setCurrentUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [openDetailSection, setOpenDetailSection] = useState<string | null>(null);

  const slug = useMemo(
    () => resolveProductSlug(pathname, searchSlug),
    [pathname, searchSlug]
  );

  useEffect(() => {
    return subscribeToSarees(
      (nextProducts) => {
        setProducts(nextProducts.filter((product) => product.status !== "draft"));
        setLoading(false);
      },
      {}
    );
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (slug) {
      const cleanPath = buildProductDetailPath(slug);

      if (window.location.pathname !== cleanPath) {
        window.history.replaceState(window.history.state, "", `${cleanPath}${window.location.hash}`);
      }
    }

    setCurrentUrl(window.location.href);
  }, [slug]);

  const visibleProducts = useMemo(
    () => products.filter((product) => product.status !== "draft"),
    [products]
  );

  const product = useMemo(() => {
    if (!slug) {
      return null;
    }

    const normalizedSlug = slug.toLowerCase();

    return (
      visibleProducts.find((item) => item.slug.toLowerCase() === normalizedSlug) ??
      visibleProducts.find((item) => item.sku.toLowerCase() === normalizedSlug) ??
      null
    );
  }, [slug, visibleProducts]);

  const galleryImages = useMemo(() => {
    if (!product) {
      return [];
    }

    const imageEntries = [
      {
        url: product.primaryImageUrl,
        path: product.primaryImagePath ?? ""
      },
      ...product.galleryImageUrls.map((url, index) => ({
        url,
        path: product.galleryImagePaths?.[index] ?? ""
      }))
    ];

    const uniqueImages = new Map<string, string>();

    imageEntries.forEach(({ url, path }) => {
      const cleanUrl = url.trim();

      if (!cleanUrl) {
        return;
      }

      const identifier = buildImageIdentifier(cleanUrl, path);

      if (!uniqueImages.has(identifier)) {
        uniqueImages.set(identifier, cleanUrl);
      }
    });

    return Array.from(uniqueImages.values());
  }, [product]);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [product?.slug]);

  useEffect(() => {
    setOpenDetailSection(null);
  }, [product?.slug]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopied(false);
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copied]);

  const relatedProducts = useMemo(() => {
    if (!product) {
      return visibleProducts.slice(0, 8);
    }

    const sameCategory = visibleProducts.filter(
      (item) => item.slug !== product.slug && item.category === product.category
    );

    if (sameCategory.length > 0) {
      return sameCategory;
    }

    return visibleProducts.filter((item) => item.slug !== product.slug).slice(0, 8);
  }, [product, visibleProducts]);

  const relatedHeading = product
    ? relatedProducts.some((item) => item.category === product.category)
      ? `More from ${product.category}`
      : "More sarees to explore"
    : "Explore the boutique collection";

  const relatedDescription = product
    ? relatedProducts.some((item) => item.category === product.category)
      ? "More pieces from the same category, chosen in a similar mood and drape."
      : "This category is limited right now, so here are more boutique picks you may like."
    : "Browse other available sarees from the current collection.";

  const activeImage = galleryImages[activeImageIndex] || product?.primaryImageUrl || "";
  const productDetailFacts = product ? buildProductDetailFacts(product) : [];
  const designDetailFacts = product ? buildDesignDetailFacts(product) : [];
  const materialCareFacts = product ? buildMaterialCareFacts(product) : [];
  const sareeCareTips = product?.sareeCareTips?.length ? product.sareeCareTips : defaultSareeCareTips;
  const dryingTips = product?.dryingTips?.length ? product.dryingTips : defaultDryingTips;
  const cartQuantity = product ? items.find((item) => item.sku === product.sku)?.quantity ?? 0 : 0;

  function showPreviousImage() {
    if (galleryImages.length <= 1) {
      return;
    }

    setActiveImageIndex((current) => (current === 0 ? galleryImages.length - 1 : current - 1));
  }

  function showNextImage() {
    if (galleryImages.length <= 1) {
      return;
    }

    setActiveImageIndex((current) => (current === galleryImages.length - 1 ? 0 : current + 1));
  }

  async function handleCopyLink() {
    if (typeof navigator === "undefined" || !currentUrl) {
      return;
    }

    await navigator.clipboard.writeText(currentUrl);
    setCopied(true);
  }

  function handleAddToCart() {
    if (!product || product.status !== "active") {
      return;
    }

    addItem(product, 1);
  }

  function handleDecreaseCartQuantity() {
    if (!product || cartQuantity <= 0) {
      return;
    }

    updateQuantity(product.sku, cartQuantity - 1);
  }

  function handleIncreaseCartQuantity() {
    if (!product || product.status !== "active") {
      return;
    }

    if (cartQuantity === 0) {
      addItem(product, 1);
      return;
    }

    updateQuantity(product.sku, cartQuantity + 1);
  }

  return (
    <main className="min-h-screen bg-[#fbf4e8] text-[#4f5942]">
      <StorefrontHeader />

      <section className="px-6 py-10 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-7xl">
          {loading ? (
            <ProductDetailSkeleton />
          ) : !product ? (
            <div className="space-y-10">
              <EmptyCatalogueState
                title="This saree is unavailable"
                description="The product link may be outdated. Browse the collection below instead."
              />

              {relatedProducts.length > 0 ? (
                <section className="rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-6 shadow-[0_24px_60px_rgba(94,104,79,0.08)] sm:p-8">
                  <div className="text-center">
                    <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">
                      EXPLORE MORE
                    </p>
                    <h2 className="brand-copy mt-3 text-2xl text-[#3f4738] sm:text-[2rem]">
                      {relatedHeading}
                    </h2>
                  </div>

                  <div className="mt-8">
                    <ProductCardCarousel products={relatedProducts} />
                  </div>
                </section>
              ) : null}
            </div>
          ) : (
            <>
              <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-[#667056]">
                <Link href="/" className="transition-colors duration-300 hover:text-[#4f5942]">
                  Home
                </Link>
                <span>/</span>
                <Link href="/shop" className="transition-colors duration-300 hover:text-[#4f5942]">
                  Shop
                </Link>
                <span>/</span>
                <Link
                  href={buildShopHref({ browse: "curated", filter: product.category })}
                  className="transition-colors duration-300 hover:text-[#4f5942]"
                >
                  {product.category}
                </Link>
                <span>/</span>
                <span className="text-[#4f5942]">{product.name}</span>
              </div>

              <div className="grid gap-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:items-start lg:gap-10">
                <section>
                  <div className="relative overflow-hidden rounded-[2rem] bg-[#efe5d7] shadow-[0_24px_60px_rgba(94,104,79,0.08)]">
                    <div
                      className="aspect-[0.86] w-full"
                      style={{
                        backgroundImage: activeImage
                          ? `linear-gradient(180deg, rgba(255,249,236,0.04), rgba(43,24,14,0.08)), url('${activeImage}')`
                          : "linear-gradient(180deg, #e8dfd4 0%, #b7b2ad 100%)",
                        backgroundPosition: "center",
                        backgroundSize: "cover"
                      }}
                    />

                    <div className="absolute left-5 top-5 flex flex-col gap-3">
                      {typeof product.discountPercent === "number" && product.discountPercent > 0 ? (
                        <span className="brand-caption rounded-[0.85rem] bg-[#5e684f] px-4 py-2 text-[0.56rem] font-semibold tracking-[0.08em] text-[#fbf4e8]">
                          -{product.discountPercent}% OFF
                        </span>
                      ) : null}
                      {product.status === "out_of_stock" ? (
                        <span className="brand-caption rounded-[0.85rem] bg-[#3f4738] px-4 py-2 text-[0.56rem] font-semibold tracking-[0.08em] text-[#fbf4e8]">
                          OUT OF STOCK
                        </span>
                      ) : null}
                    </div>

                    {galleryImages.length > 1 ? (
                      <>
                        <button
                          type="button"
                          onClick={showPreviousImage}
                          aria-label="Previous image"
                          className="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-[#fbf4e8]/82 text-3xl leading-none text-[#4f5942] shadow-[0_12px_30px_rgba(43,42,41,0.12)] transition-colors duration-300 hover:bg-[#fbf4e8]"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          onClick={showNextImage}
                          aria-label="Next image"
                          className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-[#fbf4e8]/82 text-3xl leading-none text-[#4f5942] shadow-[0_12px_30px_rgba(43,42,41,0.12)] transition-colors duration-300 hover:bg-[#fbf4e8]"
                        >
                          ›
                        </button>
                      </>
                    ) : null}
                  </div>

                </section>

                <section className="space-y-4 lg:flex lg:min-h-[760px] lg:flex-col">
                  <div>
                    <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">
                      {product.collectionLabel || product.category.toUpperCase()}
                    </p>
                    <h1 className="brand-copy mt-3 text-[2rem] leading-[1.08] text-[#1f1a17] sm:text-[2.5rem]">
                      {product.name}
                    </h1>

                    <div className="mt-4 flex items-center gap-3 whitespace-nowrap">
                      <span className="text-[1.35rem] font-semibold text-[#1f1a17] sm:text-[1.5rem]">
                        {formatCurrency(product.price)}
                      </span>
                      {typeof product.originalPrice === "number" ? (
                        <span className="text-[1.35rem] text-[#8d8b87] line-through sm:text-[1.5rem]">
                          {formatCurrency(product.originalPrice)}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-[0.95rem] text-[#667056]">
                      <span>{product.fabric}</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-[#bca98a]" />
                      <span>{product.color}</span>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Link
                        href={buildShopHref({ browse: "curated", filter: product.category })}
                        className="brand-caption inline-flex h-[38px] w-[112px] shrink-0 items-center justify-center rounded-2xl border border-[#d6ccb9] px-3 text-[0.54rem] font-semibold tracking-[0.08em] text-[#5e684f]"
                      >
                        VIEW SIMILAR
                      </Link>
                      {product.status === "out_of_stock" ? (
                        <button
                          type="button"
                          className="brand-caption inline-flex h-[38px] w-[112px] shrink-0 items-center justify-center cursor-not-allowed rounded-2xl bg-[#3f4738] px-3 text-[0.54rem] font-semibold tracking-[0.08em] text-[#fbf4e8]"
                          disabled
                        >
                          JOIN WAITLIST
                        </button>
                      ) : cartQuantity > 0 ? (
                        <div className="grid h-[38px] w-[112px] shrink-0 grid-cols-[24px_1fr_24px] items-center rounded-2xl border border-[#d6ccb9] bg-[#5e684f] px-1 text-[#fbf4e8]">
                          <InlineCartButton label="Decrease quantity" onClick={handleDecreaseCartQuantity}>
                            -
                          </InlineCartButton>
                          <span className="text-center text-[0.78rem] font-semibold leading-none">{cartQuantity}</span>
                          <InlineCartButton label="Increase quantity" onClick={handleIncreaseCartQuantity}>
                            +
                          </InlineCartButton>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleAddToCart}
                          className="brand-caption inline-flex h-[38px] w-[112px] shrink-0 items-center justify-center rounded-2xl bg-[#5e684f] px-3 text-[0.54rem] font-semibold tracking-[0.08em] text-[#fbf4e8]"
                        >
                          ADD TO CART
                        </button>
                      )}
                    </div>

                    <p className="mt-4 max-w-2xl text-sm leading-6 text-[#667056] sm:text-[0.95rem]">
                      {product.description}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <DetailAccordionSection
                      id="product-details"
                      title="Product Details"
                      isOpen={openDetailSection === "product-details"}
                      onToggle={setOpenDetailSection}
                      entries={productDetailFacts}
                    />
                    <DetailAccordionSection
                      id="design-details"
                      title="Design Details"
                      isOpen={openDetailSection === "design-details"}
                      onToggle={setOpenDetailSection}
                      entries={designDetailFacts}
                    />
                    <DetailAccordionSection
                      id="material-care"
                      title="Material & Care"
                      isOpen={openDetailSection === "material-care"}
                      onToggle={setOpenDetailSection}
                      entries={materialCareFacts}
                      careTips={sareeCareTips}
                      dryingTips={dryingTips}
                    />
                  </div>

                  <div className="rounded-[1.15rem] border border-[#ddd1c0] bg-[#fbf7ef] px-4 py-3 sm:px-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[0.76rem] text-[#667056]">{copied ? "Link copied" : "Share this saree"}</span>
                      <ShareIconLink
                        href={buildFacebookShareUrl(currentUrl)}
                        label="Share on Facebook"
                        icon={<FacebookIcon />}
                      />
                      <ShareIconLink
                        href={buildWhatsAppShareUrl(currentUrl, product.name)}
                        label="Share on WhatsApp"
                        icon={<WhatsAppIcon />}
                      />
                      <ShareIconLink
                        href={buildTelegramShareUrl(currentUrl, product.name)}
                        label="Share on Telegram"
                        icon={<TelegramIcon />}
                      />
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#d6ccb9] bg-white/65 text-[#4f5942] transition-colors duration-300 hover:border-[#5e684f] hover:text-[#5e684f]"
                        aria-label="Copy link"
                      >
                        <LinkIcon />
                      </button>
                      <ShareIconLink
                        href={buildMailShareUrl(currentUrl, product.name)}
                        label="Share by email"
                        icon={<MailIcon />}
                      />
                    </div>

                    {(product.productNote || defaultProductNote) ? (
                      <div className="mt-3 border-t border-[#e3d8c9] pt-3">
                        <p className="text-[0.74rem] leading-5 text-[#7a7f72]">
                          {product.productNote || defaultProductNote}
                        </p>
                      </div>
                    ) : null}
                  </div>

                </section>
              </div>

              {relatedProducts.length > 0 ? (
                <section className="mt-16 rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-6 shadow-[0_24px_60px_rgba(94,104,79,0.08)] sm:p-8">
                  <div className="text-center">
                    <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">
                      MORE TO EXPLORE
                    </p>
                    <h2 className="brand-copy mt-3 text-2xl text-[#3f4738] sm:text-[2rem]">
                      {relatedHeading}
                    </h2>
                    <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[#667056]">
                      {relatedDescription}
                    </p>
                  </div>

                  <div className="mt-8">
                    {relatedProducts.length === 1 ? (
                      <div className="mx-auto max-w-[250px]">
                        <CatalogueProductCard product={relatedProducts[0]} />
                      </div>
                    ) : (
                      <ProductCardCarousel products={relatedProducts} />
                    )}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </div>
      </section>

      <SiteFooter homeHref="/" featuredHref="/shop/featured/" contactId="contact" />
    </main>
  );
}

function InlineCartButton({
  label,
  children,
  onClick
}: {
  label: string;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-[22px] w-[22px] items-center justify-center rounded-[0.7rem] bg-[#fbf4e8]/14 text-[0.9rem] leading-none text-[#fbf4e8] transition-colors duration-200 hover:bg-[#fbf4e8]/22"
    >
      {children}
    </button>
  );
}

function ProductDetailSkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-12">
      <div>
        <div className="aspect-[0.86] animate-pulse rounded-[2rem] bg-[#e8decf]" />
        <div className="mt-5 flex gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 w-20 animate-pulse rounded-[1rem] bg-[#eadfce]" />
          ))}
        </div>
      </div>

      <div className="space-y-5">
        <div className="h-4 w-28 animate-pulse rounded-full bg-[#eadfce]" />
        <div className="h-16 w-4/5 animate-pulse rounded-[1rem] bg-[#eadfce]" />
        <div className="h-10 w-1/2 animate-pulse rounded-full bg-[#eadfce]" />
        <div className="h-24 animate-pulse rounded-[1.5rem] bg-[#eadfce]" />
        <div className="h-64 animate-pulse rounded-[1.75rem] bg-[#eadfce]" />
        <div className="h-14 w-52 animate-pulse rounded-full bg-[#d9ceb9]" />
      </div>
    </div>
  );
}

function DetailAccordionSection({
  id,
  title,
  isOpen,
  onToggle,
  entries,
  careTips,
  dryingTips
}: {
  id: string;
  title: string;
  isOpen: boolean;
  onToggle: (id: string | null) => void;
  entries: Array<{ label: string; value: string }>;
  careTips?: string[];
  dryingTips?: string[];
}) {
  const hasContent = entries.length > 0 || (careTips?.length ?? 0) > 0 || (dryingTips?.length ?? 0) > 0;

  if (!hasContent) {
    return null;
  }

  return (
    <article
      className={`overflow-hidden rounded-[1.35rem] border transition-colors duration-300 ${
        isOpen
          ? "border-[#b7a48a] bg-[#fbf7ef]"
          : "border-[#ddd1c0] bg-[rgba(251,247,239,0.65)]"
      }`}
    >
      <button
        type="button"
        onClick={() => onToggle(isOpen ? null : id)}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left sm:px-5"
        aria-expanded={isOpen}
      >
        <h3 className="brand-copy text-[1rem] leading-tight text-[#2b2a29] sm:text-[1.06rem]">{title}</h3>
        <AccordionPlusIcon open={isOpen} />
      </button>

      {isOpen ? (
        <div className="border-t border-[#e5d9ca] px-4 py-4 sm:px-5">
          {entries.length > 0 ? (
            <div className="grid gap-3">
              {entries.map((item) => (
                <div
                  key={item.label}
                  className="grid gap-1.5 rounded-[1rem] bg-white/45 px-4 py-3 sm:grid-cols-[120px_1fr]"
                >
                  <p className="text-[0.68rem] font-medium uppercase tracking-[0.08em] text-[#7a7f72]">
                    {item.label}
                  </p>
                  <p className="text-[0.84rem] leading-5 text-[#2b2a29]">{item.value}</p>
                </div>
              ))}
            </div>
          ) : null}

          {careTips?.length ? (
            <div className="mt-4">
              <p className="brand-caption text-[0.54rem] font-semibold tracking-[0.16em] text-[#7d876f]">
                CARE & HANDLING
              </p>
              <div className="mt-3 grid gap-2.5">
                {careTips.map((item, index) => (
                  <DetailTipRow key={`${title}-care-${index}`} index={index} content={item} />
                ))}
              </div>
            </div>
          ) : null}

          {dryingTips?.length ? (
            <div className="mt-4">
              <p className="brand-caption text-[0.54rem] font-semibold tracking-[0.16em] text-[#7d876f]">
                DRYING & FINISHING
              </p>
              <div className="mt-3 grid gap-2.5">
                {dryingTips.map((item, index) => (
                  <DetailTipRow key={`${title}-drying-${index}`} index={index} content={item} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function DetailTipRow({
  index,
  content
}: {
  index: number;
  content: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[1rem] border border-[#e7dccd] bg-white/45 px-4 py-3">
      <span className="brand-caption mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#5e684f] text-[0.5rem] font-semibold tracking-[0.08em] text-[#fbf4e8]">
        {String(index + 1).padStart(2, "0")}
      </span>
      <p className="text-[0.82rem] leading-5 text-[#667056] sm:text-[0.84rem]">{content}</p>
    </div>
  );
}

function AccordionPlusIcon({ open }: { open: boolean }) {
  return (
    <span className="relative block h-7 w-7 shrink-0 text-[#6e7467]" aria-hidden="true">
      <span className="absolute left-1/2 top-1/2 h-[1.5px] w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
      <span
        className={`absolute left-1/2 top-1/2 h-5 w-[1.5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-current transition-transform duration-200 ${
          open ? "scale-y-0" : "scale-y-100"
        }`}
      />
    </span>
  );
}

function ShareIconLink({
  href,
  label,
  icon
}: {
  href: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d6ccb9] bg-white/65 text-[#4f5942] transition-colors duration-300 hover:border-[#5e684f] hover:text-[#5e684f]"
    >
      {icon}
    </a>
  );
}

function buildProductDetailFacts(product: Saree) {
  return [
    { label: "Category", value: product.category },
    { label: "SKU", value: product.sku },
    { label: "Length", value: product.length || defaultProductLength }
  ];
}

function buildDesignDetailFacts(product: Saree) {
  return [
    { label: "Color", value: product.color },
    { label: "Description", value: product.description }
  ];
}

function buildMaterialCareFacts(product: Saree) {
  return [
    { label: "Material", value: product.fabric },
    { label: "Wash", value: product.washCare || defaultWashCare }
  ];
}

function buildImageIdentifier(url: string, path?: string | null) {
  const cleanPath = path?.trim();

  if (cleanPath) {
    return cleanPath;
  }

  try {
    const parsedUrl = new URL(url);
    return `${parsedUrl.origin}${parsedUrl.pathname}`;
  } catch {
    return url.split("?")[0].split("#")[0].trim();
  }
}

function buildFacebookShareUrl(url: string) {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url || "https://eshwe.com/product")}`;
}

function buildWhatsAppShareUrl(url: string, name: string) {
  return `https://wa.me/?text=${encodeURIComponent(`Take a look at ${name} on eshwe: ${url}`)}`;
}

function buildTelegramShareUrl(url: string, name: string) {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`Take a look at ${name} on eshwe`)}`;
}

function buildMailShareUrl(url: string, name: string) {
  return `mailto:?subject=${encodeURIComponent(`eshwe | ${name}`)}&body=${encodeURIComponent(
    `I wanted to share this saree with you: ${url}`
  )}`;
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M13.5 22v-8h2.8l.5-3h-3.3V9.2c0-.9.4-1.7 1.8-1.7h1.7V4.9c-.3 0-1.4-.1-2.7-.1-2.7 0-4.5 1.6-4.5 4.7V11H7.5v3h2.8v8h3.2Z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M20 11.8A8 8 0 0 0 6.4 6L5 2.5 1.5 4l1.4 3.4A8 8 0 1 0 20 11.8Zm-8 6.5a6.5 6.5 0 0 1-3.3-.9l-.2-.1-2 .5.5-1.9-.1-.2a6.5 6.5 0 1 1 5.1 2.6Zm3.6-4.9c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.6.8c-.1.1-.3.2-.5.1-.2-.1-.8-.3-1.5-1-.6-.6-1.1-1.4-1.2-1.6-.1-.2 0-.4.1-.5l.4-.5.2-.4c.1-.1 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4H8c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.1.9 2.3c.1.2 1.6 2.4 3.8 3.4.5.2 1 .4 1.4.5.6.2 1.1.1 1.5.1.5-.1 1.4-.6 1.6-1.2.2-.6.2-1.1.1-1.2-.1 0-.3-.1-.5-.2Z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="m21.8 4.6-3 14c-.2 1-.8 1.2-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.8 8.8-8c.4-.3-.1-.5-.6-.2L6.7 12.5l-4.7-1.5c-1-.3-1-1 .2-1.5L20.7 3c.8-.3 1.4.2 1.1 1.6Z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M10.5 13.5 13.5 10.5" />
      <path d="M7.8 14.2 5.7 16.3a3 3 0 1 0 4.2 4.2l2.1-2.1" />
      <path d="m16.2 9.8 2.1-2.1a3 3 0 0 0-4.2-4.2l-2.1 2.1" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3.5" y="6" width="17" height="12" rx="2.5" />
      <path d="m5.5 8 6.5 5 6.5-5" />
    </svg>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(value);
}
