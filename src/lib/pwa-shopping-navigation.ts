const VISIT_KEY = "eshwe.pwaProductVisit";
const RETURN_KEY = "eshwe.pwaShoppingReturn";
const STATE_KEY = "eshweProductOrigin";
type BrowsePosition = { href: string; scrollY: number };
type ProductVisit = { productPath: string; origin: BrowsePosition };

export function validBrowsePosition(value: unknown): BrowsePosition | null {
  const position = value as Partial<BrowsePosition> | null;
  if (!position || typeof position.href !== "string" || !Number.isFinite(position.scrollY) || position.scrollY! < 0) return null;
  let url: URL;
  try { url = new URL(position.href, "https://eshwe.com"); } catch { return null; }
  if (url.origin !== "https://eshwe.com" || !/^\/app\/(?:search(?:\/|$)|favorites\/?$|$)/.test(url.pathname)) return null;
  return { href: url.pathname + url.search + url.hash, scrollY: position.scrollY! };
}

function productPath(url: URL) {
  if (!/^\/app\/product(?:\/|$)/.test(url.pathname)) return null;
  const slug = url.searchParams.get("slug") || url.pathname.split("/").filter(Boolean)[2];
  return slug ? `/app/product/${slug}/` : null;
}

// Called only for ordinary same-tab product-link clicks within the PWA.
export function rememberPwaProductVisit(href: string) {
  try {
    const target = new URL(href, location.href);
    const targetPath = target.origin === location.origin ? productPath(target) : null;
    if (!targetPath) return;
    const currentPath = productPath(new URL(location.href));
    const prior = history.state?.[STATE_KEY] as ProductVisit | undefined;
    const origin = currentPath
      ? prior?.productPath === currentPath ? validBrowsePosition(prior.origin) : null
      : validBrowsePosition({ href: location.pathname + location.search + location.hash, scrollY: window.scrollY });
    sessionStorage.removeItem(VISIT_KEY);
    if (origin) sessionStorage.setItem(VISIT_KEY, JSON.stringify({ productPath: targetPath, origin }));
  } catch { /* Browse remains available if browser storage is disabled. */ }
}

export function attachPwaProductOrigin(path: string) {
  try {
    const pending = JSON.parse(sessionStorage.getItem(VISIT_KEY) || "null") as ProductVisit | null;
    sessionStorage.removeItem(VISIT_KEY);
    if (pending?.productPath !== path) return;
    const origin = validBrowsePosition(pending.origin);
    if (origin) history.replaceState({ ...history.state, [STATE_KEY]: { productPath: path, origin } }, "");
  } catch { /* A direct/shared link uses Browse as its fallback. */ }
}

export function preparePwaShoppingReturn(path: string) {
  try {
    const visit = history.state?.[STATE_KEY] as ProductVisit | undefined;
    const origin = visit?.productPath === path ? validBrowsePosition(visit.origin) : null;
    sessionStorage.removeItem(RETURN_KEY);
    const target = origin || { href: "/app/search/", scrollY: 0 };
    sessionStorage.setItem(RETURN_KEY, JSON.stringify(target));
    return target.href;
  } catch { /* A safe in-app fallback also works without storage. */ }
  return "/app/search/";
}

export function restorePwaShoppingPosition(frame: HTMLElement) {
  let position: BrowsePosition | null = null;
  try { position = validBrowsePosition(JSON.parse(sessionStorage.getItem(RETURN_KEY) || "null")); } catch { return; }
  if (!position) return;
  const href = position.href;
  const top = position.scrollY;
  let observer: ResizeObserver | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let frameId = 0;
  function disconnect() {
    observer?.disconnect(); clearTimeout(timer); cancelAnimationFrame(frameId);
    window.removeEventListener("touchstart", stop); window.removeEventListener("wheel", stop); window.removeEventListener("keydown", stop);
  }
  function stop() {
    disconnect();
    try { sessionStorage.removeItem(RETURN_KEY); } catch { /* Storage is optional. */ }
  }
  function restore(force = false) {
    if (href !== location.pathname + location.search + location.hash) return;
    if (!force && document.documentElement.scrollHeight - innerHeight < top) return;
    window.scrollTo({ top, behavior: "instant" }); stop();
  }
  observer = new ResizeObserver(() => { cancelAnimationFrame(frameId); frameId = requestAnimationFrame(() => restore()); });
  observer.observe(frame);
  window.addEventListener("touchstart", stop, { passive: true }); window.addEventListener("wheel", stop, { passive: true }); window.addEventListener("keydown", stop);
  timer = setTimeout(() => restore(true), 5000);
  frameId = requestAnimationFrame(() => restore());
  // Loading shells and cached route transitions can remount before the grid is
  // ready. Preserve the pending position for the next shell to finish restoring.
  return disconnect;
}
