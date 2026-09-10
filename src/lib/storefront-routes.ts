import { slugifySareeName } from "@/lib/sarees";

type ShopBrowseMode = "all" | "new-arrivals" | "featured" | "curated";

export function buildProductDetailPath(slug: string) {
  const normalizedSlug = slugifySareeName(slug);
  return normalizedSlug ? `/product/${normalizedSlug}/` : "/product/";
}

export function buildProductDetailHref(slug: string) {
  return buildProductDetailPath(slug);
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
  return buildShopSearchHref(options);
}

export function buildShopSearchHref(options?: { browse?: ShopBrowseMode; filter?: string; q?: string }) {
  const searchParams = new URLSearchParams();

  if (!options || options.browse === "all" || !options.browse) {
    if (options?.q?.trim()) {
      searchParams.set("q", options.q.trim());
    }

    const query = searchParams.toString();
    return query ? `/shop/?${query}` : "/shop/";
  }

  if (options.browse === "new-arrivals") {
    searchParams.set("browse", "new-arrivals");
    if (options.q?.trim()) {
      searchParams.set("q", options.q.trim());
    }
    return `/shop/?${searchParams.toString()}`;
  }

  if (options.browse === "featured") {
    searchParams.set("browse", "featured");
    if (options.q?.trim()) {
      searchParams.set("q", options.q.trim());
    }
    return `/shop/?${searchParams.toString()}`;
  }

  if (options.filter?.trim()) {
    searchParams.set("browse", "curated");
    searchParams.set("filter", options.filter.trim());
  }

  if (options.q?.trim()) {
    searchParams.set("q", options.q.trim());
  }

  const query = searchParams.toString();
  return query ? `/shop/?${query}` : "/shop/";
}

export function buildShopVisiblePath(options?: { browse?: ShopBrowseMode; filter?: string; q?: string }) {
  const basePath = buildShopPath(options);
  const normalizedQuery = slugifySareeName(options?.q ?? "");

  if (!normalizedQuery) {
    return basePath;
  }

  return `${basePath}search/${normalizedQuery}/`;
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

export function resolveShopSearchQuery(pathname: string, searchQuery?: string | null) {
  const queryValue = searchQuery?.trim();
  const segments = pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));

  if (segments[0] !== "shop") {
    return queryValue ?? "";
  }

  if (segments[1] === "search" && segments[2]) {
    return decodeRouteSearchText(segments.slice(2).join(" "));
  }

  if ((segments[1] === "new-arrivals" || segments[1] === "featured") && segments[2] === "search" && segments[3]) {
    return decodeRouteSearchText(segments.slice(3).join(" "));
  }

  if (segments[1] === "category") {
    const searchIndex = segments.findIndex((segment, index) => index > 1 && segment === "search");

    if (searchIndex !== -1 && segments[searchIndex + 1]) {
      return decodeRouteSearchText(segments.slice(searchIndex + 1).join(" "));
    }
  }

  return queryValue ?? "";
}

export function matchesRouteIdentifier(value: string, identifier: string) {
  return normalizeRouteIdentifier(value) === normalizeRouteIdentifier(identifier);
}

function normalizeRouteIdentifier(value: string) {
  return slugifySareeName(decodeURIComponent(value).trim());
}

function decodeRouteSearchText(value: string) {
  return decodeURIComponent(value)
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
