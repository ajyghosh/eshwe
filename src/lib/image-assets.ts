const optimizedAssets: Record<string, string> = {
  "/eshwelogo-transparent.png": "/eshwelogo-transparent.webp",
  "/eshwelogo.png": "/eshwelogo.webp",
  "/home.PNG": "/home.webp",
  "/homepagebg.png": "/homepagebg.webp"
};

// Resolve legacy local asset references without changing catalogue records.
export function optimizedImageUrl(value: string): string {
  if (optimizedAssets[value]) return optimizedAssets[value];
  try {
    const url = new URL(value);
    if (url.origin === "https://eshwe.com" && optimizedAssets[url.pathname]) {
      return optimizedAssets[url.pathname];
    }
  } catch { /* Relative non-asset paths and uploaded images are unchanged. */ }
  return value;
}
