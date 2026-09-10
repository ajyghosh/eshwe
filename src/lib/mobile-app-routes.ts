import { slugifySareeName } from "@/lib/sarees";

type AppSearchParams = {
  category?: string;
  fabric?: string;
  intent?: string;
  q?: string;
  sort?: string;
};

export function buildAppHomeHref() {
  return "/app/";
}

export function buildAppSearchHref(params?: AppSearchParams) {
  const searchParams = new URLSearchParams();

  if (params?.q?.trim()) {
    searchParams.set("q", params.q.trim());
  }

  if (params?.category?.trim()) {
    searchParams.set("category", params.category.trim());
  }

  if (params?.fabric?.trim()) {
    searchParams.set("fabric", params.fabric.trim());
  }

  if (params?.intent?.trim()) {
    searchParams.set("intent", params.intent.trim());
  }

  if (params?.sort?.trim()) {
    searchParams.set("sort", params.sort.trim());
  }

  const query = searchParams.toString();
  return query ? `/app/search/?${query}` : "/app/search/";
}

export function buildAppSearchVisiblePath(params?: AppSearchParams) {
  const searchParams = new URLSearchParams();
  const normalizedQuery = slugifySareeName(params?.q ?? "");
  const normalizedCategory = slugifySareeName(params?.category ?? "");
  const normalizedFabric = slugifySareeName(params?.fabric ?? "");
  const normalizedIntent = slugifySareeName(params?.intent ?? "");
  const normalizedSort = (params?.sort ?? "").trim();

  let basePath = "/app/search/";

  if (normalizedQuery) {
    basePath = `/app/search/${normalizedQuery}/`;
  } else if (normalizedCategory) {
    basePath = `/app/search/category/${normalizedCategory}/`;
  } else if (normalizedFabric) {
    basePath = `/app/search/fabric/${normalizedFabric}/`;
  } else if (normalizedIntent) {
    basePath = `/app/search/intent/${normalizedIntent}/`;
  }

  if (normalizedQuery && params?.category?.trim()) {
    searchParams.set("category", params.category.trim());
  }

  if (normalizedQuery && params?.fabric?.trim()) {
    searchParams.set("fabric", params.fabric.trim());
  }

  if (normalizedQuery && params?.intent?.trim()) {
    searchParams.set("intent", params.intent.trim());
  }

  if (!normalizedQuery && normalizedCategory && params?.fabric?.trim()) {
    searchParams.set("fabric", params.fabric.trim());
  }

  if (!normalizedQuery && normalizedCategory && params?.intent?.trim()) {
    searchParams.set("intent", params.intent.trim());
  }

  if (!normalizedQuery && !normalizedCategory && normalizedFabric && params?.intent?.trim()) {
    searchParams.set("intent", params.intent.trim());
  }

  if (normalizedSort && normalizedSort !== "relevance") {
    searchParams.set("sort", normalizedSort);
  }

  const query = searchParams.toString();
  return `${basePath}${query ? `?${query}` : ""}`;
}

export function buildAppCategoryHref(category: string) {
  return buildAppSearchHref({ category });
}

export function buildAppProductHref(slug: string) {
  const normalizedSlug = slugifySareeName(slug);
  return normalizedSlug ? `/app/product/?slug=${encodeURIComponent(normalizedSlug)}` : "/app/search/";
}

export function buildAppProductPath(slug: string) {
  const normalizedSlug = slugifySareeName(slug);
  return normalizedSlug ? `/app/product/${normalizedSlug}/` : "/app/search/";
}

export function buildAppCheckoutHref() {
  return "/app/checkout/";
}

export function buildAppFavoritesHref() {
  return "/app/favorites/";
}

export function buildAppOrdersHref() {
  return "/app/orders/";
}

export function buildAppAccountHref() {
  return "/app/account/";
}

export function buildAppTermsHref() {
  return "/app/terms-and-conditions/";
}

export function buildAppPrivacyHref() {
  return "/app/privacy-policy/";
}

export function buildAppReturnPolicyHref() {
  return "/app/return-policy/";
}

export function resolveAppProductSlug(pathname: string, searchSlug?: string | null) {
  const querySlug = searchSlug?.trim();

  if (querySlug) {
    return decodeURIComponent(querySlug);
  }

  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "app" && segments[1] === "product" && segments[2]) {
    return decodeURIComponent(segments[2]).trim();
  }

  return "";
}

export function resolveAppSearchState(
  pathname: string,
  searchState?: AppSearchParams
) {
  const segments = pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  const nextState: AppSearchParams = {
    category: searchState?.category?.trim() ?? "",
    fabric: searchState?.fabric?.trim() ?? "",
    intent: searchState?.intent?.trim() ?? "",
    q: searchState?.q?.trim() ?? "",
    sort: searchState?.sort?.trim() ?? ""
  };

  if (segments[0] === "app" && segments[1] === "search") {
    if (segments[2] === "category" && segments[3] && !nextState.category) {
      nextState.category = decodeRouteText(segments.slice(3).join(" "));
    } else if (segments[2] === "fabric" && segments[3] && !nextState.fabric) {
      nextState.fabric = decodeRouteText(segments.slice(3).join(" "));
    } else if (segments[2] === "intent" && segments[3] && !nextState.intent) {
      nextState.intent = decodeRouteText(segments.slice(3).join(" "));
    } else if (segments[2] && !nextState.q) {
      nextState.q = decodeRouteText(segments.slice(2).join(" "));
    }
  }

  return nextState;
}

function decodeRouteText(value: string) {
  return decodeURIComponent(value)
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
