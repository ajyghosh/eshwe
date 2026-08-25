"use client";

import { useEffect, useState } from "react";

import { subscribeToHomePageContent, saveHomePageContent } from "@/lib/homepage";
import { deleteSareeImages, uploadSiteAsset } from "@/lib/storage";
import {
  DEFAULT_HOME_LAUNCH_CARD_MAX_WIDTH,
  DEFAULT_HOME_PAGE_CONTENT,
  normalizeHomeLaunchCardMaxWidth,
  type HomePageContent
} from "@/types/homepage";

export function OwnerHomepageManager() {
  const [form, setForm] = useState<HomePageContent>(DEFAULT_HOME_PAGE_CONTENT);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [launchImageFile, setLaunchImageFile] = useState<File | null>(null);
  const [removeLaunchImage, setRemoveLaunchImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToHomePageContent((content) => {
      setForm(content ? { ...DEFAULT_HOME_PAGE_CONTENT, ...content } : DEFAULT_HOME_PAGE_CONTENT);
      setHeroFile(null);
      setLaunchImageFile(null);
      setRemoveLaunchImage(false);
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

      let launchImageUrl = form.launchImageUrl;
      let launchImagePath = form.launchImagePath ?? "";

      if (launchImageFile) {
        const upload = await uploadSiteAsset(launchImageFile, "site-content/home-launch");

        if (launchImagePath) {
          await deleteSareeImages([launchImagePath]);
        }

        launchImageUrl = upload.url;
        launchImagePath = upload.path;
      } else if (removeLaunchImage && launchImagePath) {
        await deleteSareeImages([launchImagePath]);
        launchImageUrl = "";
        launchImagePath = "";
      }

      await saveHomePageContent({
        heroImageUrl,
        heroImagePath,
        heroImagePosition: form.heroImagePosition.trim() || "center",
        launchEyebrow: form.launchEyebrow.trim(),
        launchHeading: form.launchHeading.trim(),
        launchBody: form.launchBody.trim(),
        launchCardMaxWidth: normalizeHomeLaunchCardMaxWidth(form.launchCardMaxWidth),
        launchImageUrl,
        launchImagePath,
        launchImageAlt: form.launchImageAlt.trim() || "Homepage announcement image",
        launchImageLayout: form.launchImageLayout,
        categoriesHeading: form.categoriesHeading.trim(),
        categoriesSubtitle: form.categoriesSubtitle.trim()
      });

      setHeroFile(null);
      setLaunchImageFile(null);
      setRemoveLaunchImage(false);
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
          Control the hero image, the soft launch card, and the category text shown on the home page.
        </p>
      </div>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-[1.2rem] border border-[#e3d8c9] bg-white/65 p-4">
              <p className="text-sm font-semibold text-[#3f4738]">Hero image</p>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-medium text-[#4f5942]">Hero image position</span>
                <input
                  value={form.heroImagePosition}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, heroImagePosition: event.target.value }))
                  }
                  className={inputClassName}
                  placeholder="center"
                />
              </label>

              <input
                type="file"
                accept="image/*"
                onChange={(event) => setHeroFile(event.target.files?.[0] ?? null)}
                className="mt-4 block w-full text-sm text-[#667056] file:mr-4 file:rounded-full file:border-0 file:bg-[#5e684f] file:px-4 file:py-2 file:text-xs file:font-semibold file:tracking-[0.08em] file:text-[#fbf4e8]"
              />
            </div>

            <div className="rounded-[1.2rem] border border-[#e3d8c9] bg-white/65 p-4">
              <p className="text-sm font-semibold text-[#3f4738]">Soft launch card</p>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-medium text-[#4f5942]">Eyebrow</span>
                <input
                  value={form.launchEyebrow}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, launchEyebrow: event.target.value }))
                  }
                  className={inputClassName}
                  placeholder="OPENING SHORTLY"
                />
              </label>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-medium text-[#4f5942]">Heading</span>
                <textarea
                  value={form.launchHeading}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, launchHeading: event.target.value }))
                  }
                  className={textAreaClassName}
                  rows={3}
                  placeholder="We are currently in a soft launch preview."
                />
              </label>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-medium text-[#4f5942]">Body copy</span>
                <textarea
                  value={form.launchBody}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, launchBody: event.target.value }))
                  }
                  className={textAreaClassName}
                  rows={5}
                  placeholder="The boutique is live for a trial run while we fine-tune the experience and curate the first collections."
                />
              </label>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#4f5942]">Card width</span>
                  <input
                    type="number"
                    min={360}
                    max={880}
                    step={10}
                    value={form.launchCardMaxWidth}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        launchCardMaxWidth: normalizeHomeLaunchCardMaxWidth(event.target.value)
                      }))
                    }
                    className={inputClassName}
                    placeholder={String(DEFAULT_HOME_LAUNCH_CARD_MAX_WIDTH)}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#4f5942]">Image layout</span>
                  <select
                    value={form.launchImageLayout}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        launchImageLayout: event.target.value as HomePageContent["launchImageLayout"]
                      }))
                    }
                    className={inputClassName}
                  >
                    <option value="right">Image on right</option>
                    <option value="left">Image on left</option>
                    <option value="top">Image on top</option>
                  </select>
                </label>
              </div>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-medium text-[#4f5942]">Promo image alt text</span>
                <input
                  value={form.launchImageAlt}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, launchImageAlt: event.target.value }))
                  }
                  className={inputClassName}
                  placeholder="Soft launch promotion"
                />
              </label>

              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  setLaunchImageFile(event.target.files?.[0] ?? null);
                  setRemoveLaunchImage(false);
                }}
                className="mt-4 block w-full text-sm text-[#667056] file:mr-4 file:rounded-full file:border-0 file:bg-[#5e684f] file:px-4 file:py-2 file:text-xs file:font-semibold file:tracking-[0.08em] file:text-[#fbf4e8]"
              />

              {form.launchImageUrl ? (
                <button
                  type="button"
                  onClick={() => {
                    setLaunchImageFile(null);
                    setRemoveLaunchImage(Boolean(form.launchImagePath));
                    setForm((current) => ({
                      ...current,
                      launchImageUrl: ""
                    }));
                  }}
                  className="mt-3 text-sm font-medium text-[#9d4b45] transition-opacity duration-200 hover:opacity-80"
                >
                  Remove promo image
                </button>
              ) : null}
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#4f5942]">Categories heading</span>
              <input
                value={form.categoriesHeading}
                onChange={(event) =>
                  setForm((current) => ({ ...current, categoriesHeading: event.target.value }))
                }
                className={inputClassName}
                placeholder="Homepage categories heading"
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
                placeholder="Homepage categories subtitle"
              />
            </label>
          </div>

          <div className="space-y-4 rounded-[1rem] border border-dashed border-[#d8cbb7] bg-white/70 p-4">
            <div>
              <p className="text-sm font-medium text-[#4f5942]">Hero preview</p>
              <div
                className="mt-4 aspect-[1.25] w-full rounded-[1rem] bg-cover bg-center"
                style={{
                  backgroundImage: form.heroImageUrl
                    ? `url('${form.heroImageUrl}')`
                    : "linear-gradient(180deg, #efe5d7 0%, #d6c7b2 100%)",
                  backgroundPosition: form.heroImagePosition || DEFAULT_HOME_PAGE_CONTENT.heroImagePosition
                }}
              />
            </div>

            <div>
              <p className="text-sm font-medium text-[#4f5942]">Soft launch card preview</p>
              <div
                className="mt-4 rounded-[1.6rem] border border-[#f3dfaa]/40 bg-[rgba(67,79,57,0.9)] p-4 text-[#fbf4e8] shadow-[0_18px_40px_rgba(43,42,41,0.16)]"
                style={{ maxWidth: `${normalizeHomeLaunchCardMaxWidth(form.launchCardMaxWidth)}px` }}
              >
                <div
                  className={`flex gap-4 ${
                    form.launchImageUrl && form.launchImageLayout !== "top"
                      ? "flex-col sm:flex-row sm:items-stretch"
                      : "flex-col"
                  }`}
                >
                  {form.launchImageUrl ? (
                    <div
                      className={`overflow-hidden rounded-[1.1rem] border border-white/12 ${
                        form.launchImageLayout === "top"
                          ? "aspect-[1.75] w-full"
                          : "aspect-[1.02] w-full sm:w-[38%] sm:min-w-[148px]"
                      } ${form.launchImageLayout === "left" ? "sm:order-1" : ""} ${
                        form.launchImageLayout === "right" ? "sm:order-2" : ""
                      }`}
                      style={{
                        backgroundImage: `url('${form.launchImageUrl}')`,
                        backgroundPosition: "center",
                        backgroundRepeat: "no-repeat",
                        backgroundSize: "cover"
                      }}
                    />
                  ) : null}

                  <div
                    className={`${form.launchImageUrl && form.launchImageLayout === "right" ? "sm:order-1" : ""} ${
                      form.launchImageUrl && form.launchImageLayout === "left" ? "sm:order-2" : ""
                    }`}
                  >
                    {form.launchEyebrow ? (
                      <p className="text-[0.58rem] font-semibold tracking-[0.22em] text-[#f3dfaa]">
                        {form.launchEyebrow}
                      </p>
                    ) : null}
                    {form.launchHeading ? (
                      <p className="mt-3 font-serif text-[1.7rem] leading-[1.1]">
                        {form.launchHeading}
                      </p>
                    ) : null}
                    {form.launchBody ? (
                      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#f8f1e3]/88">
                        {form.launchBody}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
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

const textAreaClassName =
  "min-h-[120px] w-full rounded-[1rem] border border-[#d9ccb8] bg-white/70 px-4 py-3 text-sm text-[#3f4738] outline-none transition-colors duration-200 placeholder:text-[#948978] focus:border-[#5e684f]";
