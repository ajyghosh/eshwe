import { slugifySareeName } from "@/lib/sarees";

type ShopBrowseMode = "all" | "new-arrivals" | "featured" | "curated";

export function buildProductDetailPath(slug: string) {
  const normalizedSlug = slugifySareeName(slug);
  return normalizedSlug ? `/product/${normalizedSlug}/` : "/product/";
}

export function buildProductDetailHref(slug: string) {
  return `/product/?slug=${encodeURIComponent(slug)}`;
}

export function resolveProductSlug(pathname: string, searchSlug?: string | null) {
  const querySlug = searchSlug?.trim();

  if (querySlug) {
    return decodeURIComponent(querySlug);
  }

  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "product" && segments[1]) {
    return decodeURIComponent(segments[1]).trim();
  }

  return "";
}

export function buildShopPath(options?: { browse?: ShopBrowseMode; filter?: string }) {
  if (!options || options.browse === "all" || !options.browse) {
    return "/shop/";
  }

  if (options.browse === "new-arrivals") {
    return "/shop/new-arrivals/";
  }

  if (options.browse === "featured") {
    return "/shop/featured/";
  }

  const filterSlug = slugifySareeName(options.filter ?? "");

  return filterSlug ? `/shop/category/${filterSlug}/` : "/shop/";
}

export function buildShopHref(options?: { browse?: ShopBrowseMode; filter?: string }) {
  if (!options || options.browse === "all" || !options.browse) {
    return "/shop/";
  }

  if (options.browse === "new-arrivals") {
    return "/shop/?browse=new-arrivals";
  }

  if (options.browse === "featured") {
    return "/shop/?browse=featured";
  }

  return options.filter
    ? `/shop/?browse=curated&filter=${encodeURIComponent(options.filter)}`
    : "/shop/";
}

export function resolveShopLocation(
  pathname: string,
  searchBrowse?: string | null,
  searchFilter?: string | null
) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "shop") {
    if (segments[1] === "new-arrivals") {
      return { browse: "new-arrivals" as const, filter: "" };
    }

    if (segments[1] === "featured") {
      return { browse: "featured" as const, filter: "" };
    }

    if (segments[1] === "category" && segments[2]) {
      return { browse: "curated" as const, filter: decodeURIComponent(segments.slice(2).join("/")) };
    }
  }

  if (searchBrowse === "new-arrivals") {
    return { browse: "new-arrivals" as const, filter: "" };
  }

  if (searchBrowse === "featured") {
    return { browse: "featured" as const, filter: "" };
  }

  if (searchBrowse === "curated" && searchFilter) {
    return { browse: "curated" as const, filter: decodeURIComponent(searchFilter) };
  }

  return { browse: "all" as const, filter: "" };
}

export function matchesRouteIdentifier(value: string, identifier: string) {
  return normalizeRouteIdentifier(value) === normalizeRouteIdentifier(identifier);
}

function normalizeRouteIdentifier(value: string) {
  return slugifySareeName(decodeURIComponent(value).trim());
}
