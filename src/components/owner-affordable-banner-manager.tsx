"use client";

import { useEffect, useRef, useState } from "react";
import { AffordableEleganceBanner } from "@/components/affordable-elegance-banner";
import { saveAffordableBanner, subscribeToHomePageContent } from "@/lib/homepage";
import { uploadSiteAsset } from "@/lib/storage";
import { DEFAULT_AFFORDABLE_BANNER, normalizeAffordableBanner } from "@/types/affordable-banner";

const inputClass = "w-full min-w-0 rounded-xl border border-[#d9ccb8] bg-white/70 px-4 py-3 text-sm text-[#3f4738] focus:outline-2 focus:outline-[#5e684f]";

export function OwnerAffordableBannerManager() {
  const [form, setForm] = useState(DEFAULT_AFFORDABLE_BANNER);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const dirty = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => subscribeToHomePageContent(content => {
    if (!dirty.current) setForm(normalizeAffordableBanner(content?.affordableBanner));
    setLoaded(true);
  }, () => {
    setLoaded(false);
    setError("Unable to load the banner. Reload this page before saving.");
  }), []);

  useEffect(() => {
    if (!file) { setPreviewUrl(""); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function changed() { dirty.current = true; setSuccess(""); }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!loaded || saving) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      let next = normalizeAffordableBanner(form);
      if (file) {
        const image = await uploadSiteAsset(file, "site-content/affordable-banner");
        next = { ...next, imageUrl: image.url, imagePath: image.path };
        // Keep the upload for retry if saving the document fails.
        setForm(next); setFile(null);
        if (fileInput.current) fileInput.current.value = "";
      }
      await saveAffordableBanner(next);
      setForm(next); dirty.current = false;
      setSuccess("Banner saved. Your changes are live on the website and PWA.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save the banner. Please try again.");
    } finally { setSaving(false); }
  }

  return (
    <section id="affordable-banner-settings" className="owner-settings-section rounded-[1.8rem] border border-[#e3d8c9] bg-[#f8f0e3] p-5 sm:p-8">
      <h2 className="brand-copy text-3xl text-[#3f4738]">Affordable Elegance banner</h2>
      <p className="mt-3 text-sm leading-7 text-[#667056]">Manage this separate homepage banner on both the website and PWA. The banner button opens sarees priced ₹399–₹999; products are included automatically by their selling price.</p>
      <form onSubmit={save} className="mt-6">
        <fieldset disabled={!loaded || saving} className="min-w-0 space-y-5 disabled:opacity-60">
          <label className="flex items-center gap-3 text-sm font-semibold text-[#3f4738]">
            <input type="checkbox" checked={form.enabled} onChange={event => { changed(); setForm({ ...form, enabled: event.target.checked }); }} className="h-5 w-5 accent-[#5e684f]" />
            Show banner on website and PWA
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            {([
              ["eyebrow", "Small heading", 100], ["heading", "Main heading", 60],
              ["body", "Supporting text", 100], ["buttonLabel", "Button label", 24]
            ] as const).map(([key, label, limit]) => (
              <label key={key} className="block text-sm font-medium text-[#4f5942]">
                <span className="mb-2 block">{label}</span>
                <input className={inputClass} value={form[key]} maxLength={limit} required={key === "heading" || key === "buttonLabel"} onChange={event => { changed(); setForm({ ...form, [key]: event.target.value }); }} />
              </label>
            ))}
            <label className="block text-sm font-medium text-[#4f5942]">
              <span className="mb-2 block">Banner image</span>
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className={inputClass} onChange={event => {
                const selected = event.target.files?.[0] ?? null;
                setError("");
                if (selected && (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || selected.size > 10 * 1024 * 1024)) {
                  setError("Choose a JPG, PNG or WebP image smaller than 10 MB."); event.target.value = ""; setFile(null); return;
                }
                changed(); setFile(selected);
              }} />
              <span className="mt-2 block text-xs leading-5">JPG, PNG or WebP, up to 10 MB. Images are optimized when uploaded.</span>
            </label>
            <label className="block text-sm font-medium text-[#4f5942]">
              <span className="mb-2 block">Image crop position</span>
              <select className={inputClass} value={form.imagePosition} onChange={event => { changed(); setForm({ ...form, imagePosition: event.target.value }); }}>
                <option value="68% center">Original crop</option>
                <option value="center">Center</option>
                <option value="left center">Left</option>
                <option value="right center">Right</option>
                <option value="center top">Top</option>
                <option value="center bottom">Bottom</option>
              </select>
            </label>
          </div>
          <button type="button" className="min-h-11 rounded-xl border border-[#bcb69f] px-4 py-2 text-sm font-semibold" onClick={() => {
            changed(); setFile(null); if (fileInput.current) fileInput.current.value = "";
            setForm({ ...form, imageUrl: DEFAULT_AFFORDABLE_BANNER.imageUrl, imagePath: "", imagePosition: DEFAULT_AFFORDABLE_BANNER.imagePosition });
          }}>Use original image</button>
          <div>
            <p className="mb-3 text-sm font-semibold">Preview{!form.enabled ? " — hidden from customers after saving" : ""}</p>
            <div inert className="overflow-hidden rounded-2xl">
              <AffordableEleganceBanner href="/shop/?priceRange=affordable" content={{ ...form, enabled: true, imageUrl: previewUrl || form.imageUrl }} />
            </div>
          </div>
          <button type="submit" className="min-h-11 rounded-xl bg-[#5e684f] px-6 py-3 text-sm font-semibold text-[#fbf4e8]">{saving ? "Saving banner…" : "Save banner"}</button>
        </fieldset>
        {!loaded && !error ? <p role="status" className="mt-3 text-sm">Loading banner…</p> : null}
        {error ? <p role="alert" className="mt-3 text-sm text-[#9d4b45]">{error}</p> : null}
        {success ? <p role="status" className="mt-3 text-sm text-[#3f4738]">{success}</p> : null}
      </form>
    </section>
  );
}
