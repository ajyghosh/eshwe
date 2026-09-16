export function MobileHomeSkeleton({
  kind,
  count = kind === "products" ? 4 : 5,
  error = false
}: {
  kind: "products" | "categories";
  count?: number;
  error?: boolean;
}) {
  const label = kind === "products" ? "sarees" : "categories";

  return (
    <div className="relative mt-4" aria-busy={!error}>
      <p role="status" className={error ? "absolute inset-x-3 top-3 z-10 rounded-xl bg-[#fffdf8] p-4 text-center text-sm text-[#526049]" : "sr-only"}>
        {error ? <>Unable to load {label}. <button type="button" onClick={() => window.location.reload()} className="min-h-11 underline underline-offset-4">Try again</button></> : `Loading ${label}…`}
      </p>
      <div
        aria-hidden="true"
        className={`${kind === "products" ? "mobile-app-product-grid" : "mobile-app-home-categories"} grid grid-cols-2 gap-3 ${error ? "" : "motion-safe:animate-pulse"}`}
      >
        {Array.from({ length: count }, (_, index) => kind === "categories" ? (
          <div key={index} className="overflow-hidden rounded-2xl bg-[#efe5d7]">
            <div className="mobile-app-category-image aspect-[1.15] w-full" />
          </div>
        ) : (
          <div key={index} className="mobile-app-product-card overflow-hidden rounded-2xl border border-[#e8e3d9] bg-[#fffdf8]">
            <div className="aspect-[0.86] bg-[#efe5d7]" />
            <div className="mobile-app-product-info px-3 pb-3 pt-3">
              <div className="flex-1">
                <div className="mobile-app-product-name rounded bg-[#efe5d7]" />
                <div className="mt-1 h-5 w-3/4 rounded bg-[#efe5d7]" />
                <div className="mt-1 h-5" />
              </div>
              <div className="mobile-app-product-price mt-1 grid h-9 grid-rows-[20px_16px]">
                <div className="w-1/2 rounded bg-[#efe5d7]" />
              </div>
              <div>
                <div className="h-11 rounded-xl bg-[#e4e7dc]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
