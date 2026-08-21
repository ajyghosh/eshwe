const collectionFields = [
  "name",
  "slug",
  "sku",
  "category",
  "status",
  "featured",
  "price",
  "originalPrice",
  "discountPercent",
  "collectionLabel",
  "primaryImageUrl",
  "primaryImagePath",
  "galleryImageUrls",
  "galleryImagePaths",
  "fabric",
  "color",
  "description",
  "length",
  "washCare",
  "productNote",
  "sareeCareTips",
  "dryingTips",
  "createdAt",
  "updatedAt"
];

export function SareeStatusCard() {
  return (
    <aside className="rounded-[2rem] border border-stone-300/70 bg-[var(--card)] p-6 shadow-[0_20px_80px_rgba(92,67,44,0.08)] backdrop-blur xl:p-8">
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-stone-500">
            Connected services
          </p>
          <div className="grid gap-3 text-sm text-stone-700 sm:grid-cols-2">
            <div className="rounded-2xl border border-stone-300/60 bg-white/70 p-4">
              <p className="font-semibold text-stone-900">Firestore</p>
              <p className="mt-2 leading-6 text-stone-600">Stores saree metadata and catalog details.</p>
            </div>
            <div className="rounded-2xl border border-stone-300/60 bg-white/70 p-4">
              <p className="font-semibold text-stone-900">Storage</p>
              <p className="mt-2 leading-6 text-stone-600">Stores high-resolution saree product images.</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-stone-950 p-5 text-stone-50">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-stone-300">
            Saree document shape
          </p>
          <ul className="mt-4 grid gap-2 font-mono text-sm text-stone-200">
            {collectionFields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
