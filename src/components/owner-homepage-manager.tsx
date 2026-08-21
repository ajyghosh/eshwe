"use client";

import { useEffect, useState } from "react";

import { subscribeToHomePageContent, saveHomePageContent } from "@/lib/homepage";
import { deleteSareeImages, uploadSiteAsset } from "@/lib/storage";
import type { HomePageContent } from "@/types/homepage";

const defaultHomePageContent: HomePageContent = {
  heroImageUrl: "/home.PNG",
  heroImagePath: "",
  heroImagePosition: "center 7%",
  categoriesHeading: "Categories You Might Like",
  categoriesSubtitle: "View all categories"
};

export function OwnerHomepageManager() {
  const [form, setForm] = useState<HomePageContent>(defaultHomePageContent);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToHomePageContent((content) => {
      setForm(content ? { ...defaultHomePageContent, ...content } : defaultHomePageContent);
    });
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      let heroImageUrl = form.heroImageUrl;
      let heroImagePath = form.heroImagePath ?? "";

      if (heroFile) {
        const upload = await uploadSiteAsset(heroFile, "site-content/home");

        if (heroImagePath) {
          await deleteSareeImages([heroImagePath]);
        }

        heroImageUrl = upload.url;
        heroImagePath = upload.path;
      }

      await saveHomePageContent({
        heroImageUrl,
        heroImagePath,
        heroImagePosition: form.heroImagePosition.trim() || "center 7%",
        categoriesHeading: form.categoriesHeading.trim() || defaultHomePageContent.categoriesHeading,
        categoriesSubtitle: form.categoriesSubtitle.trim() || defaultHomePageContent.categoriesSubtitle
      });

      setHeroFile(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Saving homepage content failed.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-[1.8rem] border border-[#e3d8c9] bg-[#f8f0e3] p-7 sm:p-8">
      <div className="flex flex-col gap-3">
        <h2 className="brand-copy text-3xl text-[#3f4738]">Homepage media</h2>
        <p className="text-sm leading-7 text-[#667056]">
          Control the hero image and the text shown above the category carousel.
        </p>
      </div>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#4f5942]">Hero image position</span>
              <input
                value={form.heroImagePosition}
                onChange={(event) =>
                  setForm((current) => ({ ...current, heroImagePosition: event.target.value }))
                }
                className={inputClassName}
                placeholder="center 7%"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#4f5942]">Categories heading</span>
              <input
                value={form.categoriesHeading}
                onChange={(event) =>
                  setForm((current) => ({ ...current, categoriesHeading: event.target.value }))
                }
                className={inputClassName}
                placeholder="Categories You Might Like"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#4f5942]">Categories subtitle</span>
              <input
                value={form.categoriesSubtitle}
                onChange={(event) =>
                  setForm((current) => ({ ...current, categoriesSubtitle: event.target.value }))
                }
                className={inputClassName}
                placeholder="View all categories"
              />
            </label>
          </div>

          <div className="rounded-[1rem] border border-dashed border-[#d8cbb7] bg-white/70 p-4">
            <p className="text-sm font-medium text-[#4f5942]">Hero preview</p>
            <div
              className="mt-4 aspect-[1.25] w-full rounded-[1rem] bg-cover bg-center"
              style={{
                backgroundImage: `url('${form.heroImageUrl || defaultHomePageContent.heroImageUrl}')`,
                backgroundPosition: form.heroImagePosition || defaultHomePageContent.heroImagePosition
              }}
            />
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setHeroFile(event.target.files?.[0] ?? null)}
              className="mt-4 block w-full text-sm text-[#667056] file:mr-4 file:rounded-full file:border-0 file:bg-[#5e684f] file:px-4 file:py-2 file:text-xs file:font-semibold file:tracking-[0.08em] file:text-[#fbf4e8]"
            />
          </div>
        </div>

        {error ? <p className="text-sm text-[#9d4b45]">{error}</p> : null}

        <button
          type="submit"
          disabled={isSaving}
          className="brand-caption rounded-2xl bg-[#5e684f] px-6 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#fbf4e8] disabled:opacity-60"
        >
          {isSaving ? "SAVING..." : "SAVE HOMEPAGE"}
        </button>
      </form>
    </section>
  );
}

const inputClassName =
  "h-[52px] w-full rounded-[1rem] border border-[#d9ccb8] bg-white/70 px-4 text-sm text-[#3f4738] outline-none transition-colors duration-200 placeholder:text-[#948978] focus:border-[#5e684f]";
