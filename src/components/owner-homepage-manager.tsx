"use client";

import { useEffect, useMemo, useState } from "react";

import { subscribeToHomePageContent, saveHomePageContent } from "@/lib/homepage";
import { deleteSareeImages, uploadSiteAsset } from "@/lib/storage";
import {
  DEFAULT_HOME_LAUNCH_CARD_MAX_WIDTH,
  DEFAULT_HOME_PAGE_CONTENT,
  normalizeHomeLaunchCardMaxWidth,
  normalizeMobileHomeHeroSlides,
  type MobileHomeHeroSlide,
  type HomePageContent
} from "@/types/homepage";

export function OwnerHomepageManager() {
  const [form, setForm] = useState<HomePageContent>(DEFAULT_HOME_PAGE_CONTENT);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [launchImageFile, setLaunchImageFile] = useState<File | null>(null);
  const [desktopHeroFiles, setDesktopHeroFiles] = useState<File[]>([]);
  const [mobileHeroFiles, setMobileHeroFiles] = useState<File[]>([]);
  const [desktopHeroRemovedPaths, setDesktopHeroRemovedPaths] = useState<string[]>([]);
  const [mobileHeroRemovedPaths, setMobileHeroRemovedPaths] = useState<string[]>([]);
  const [removeLaunchImage, setRemoveLaunchImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToHomePageContent((content) => {
      setForm(
        content
          ? {
              ...DEFAULT_HOME_PAGE_CONTENT,
              ...content,
              desktopHeroSlides: normalizeMobileHomeHeroSlides(content.desktopHeroSlides),
              mobileHeroSlides: normalizeMobileHomeHeroSlides(content.mobileHeroSlides)
            }
          : DEFAULT_HOME_PAGE_CONTENT
      );
      setHeroFile(null);
      setLaunchImageFile(null);
      setDesktopHeroFiles([]);
      setMobileHeroFiles([]);
      setDesktopHeroRemovedPaths([]);
      setMobileHeroRemovedPaths([]);
      setRemoveLaunchImage(false);
    });
  }, []);

  const savedMobileHeroSlides = useMemo(
    () => normalizeMobileHomeHeroSlides(form.mobileHeroSlides),
    [form.mobileHeroSlides]
  );
  const savedDesktopHeroSlides = useMemo(
    () => normalizeMobileHomeHeroSlides(form.desktopHeroSlides),
    [form.desktopHeroSlides]
  );

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

      const nextExistingDesktopSlides = savedDesktopHeroSlides;
      const uploadedDesktopSlides: MobileHomeHeroSlide[] = [];

      for (const file of desktopHeroFiles) {
        const upload = await uploadSiteAsset(file, "site-content/web-home");
        uploadedDesktopSlides.push({
          imageUrl: upload.url,
          imagePath: upload.path,
          imageAlt: file.name.replace(/\.[^.]+$/, ""),
          position: "center"
        });
      }

      const desktopHeroSlides = [...nextExistingDesktopSlides, ...uploadedDesktopSlides].slice(0, 6);

      if (desktopHeroSlides.length > 0 && desktopHeroSlides.length < 3) {
        throw new Error("Add at least 3 web home images for the carousel, or remove them all.");
      }

      const nextExistingSlides = savedMobileHeroSlides;
      const uploadedMobileSlides: MobileHomeHeroSlide[] = [];

      for (const file of mobileHeroFiles) {
        const upload = await uploadSiteAsset(file, "site-content/mobile-home");
        uploadedMobileSlides.push({
          imageUrl: upload.url,
          imagePath: upload.path,
          imageAlt: file.name.replace(/\.[^.]+$/, ""),
          position: "center"
        });
      }

      const mobileHeroSlides = [...nextExistingSlides, ...uploadedMobileSlides].slice(0, 6);

      if (mobileHeroSlides.length > 0 && mobileHeroSlides.length < 3) {
        throw new Error("Add at least 3 mobile home images for the PWA carousel, or remove them all.");
      }

      const removedHeroPaths = [...desktopHeroRemovedPaths, ...mobileHeroRemovedPaths];

      if (removedHeroPaths.length > 0) {
        await deleteSareeImages(removedHeroPaths);
      }

      await saveHomePageContent({
        heroImageUrl,
        heroImagePath,
        heroImagePosition: form.heroImagePosition.trim() || "center",
        launchEyebrow: form.launchEyebrow.trim(),
        launchHeading: form.launchHeading.trim(),
        launchBody: form.launchBody.trim(),
        mobileLaunchEyebrow: form.mobileLaunchEyebrow.trim(),
        mobileLaunchHeading: form.mobileLaunchHeading.trim(),
        mobileLaunchBody: form.mobileLaunchBody.trim(),
        mobileLaunchButtonLabel: form.mobileLaunchButtonLabel.trim() || DEFAULT_HOME_PAGE_CONTENT.mobileLaunchButtonLabel,
        mobileLaunchButtonHref: form.mobileLaunchButtonHref.trim() || DEFAULT_HOME_PAGE_CONTENT.mobileLaunchButtonHref,
        launchCardMaxWidth: normalizeHomeLaunchCardMaxWidth(form.launchCardMaxWidth),
        launchImageUrl,
        launchImagePath,
        launchImageAlt: form.launchImageAlt.trim() || "Homepage announcement image",
        launchImageLayout: form.launchImageLayout,
        categoriesHeading: form.categoriesHeading.trim(),
        categoriesSubtitle: form.categoriesSubtitle.trim(),
        desktopHeroSlides,
        mobileHeroSlides
      });

      setHeroFile(null);
      setLaunchImageFile(null);
      setDesktopHeroFiles([]);
      setMobileHeroFiles([]);
      setDesktopHeroRemovedPaths([]);
      setMobileHeroRemovedPaths([]);
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
              <p className="text-sm font-semibold text-[#3f4738]">PWA fallback hero image</p>
              <p className="mt-1 text-sm leading-6 text-[#667056]">
                Used by the PWA only when its mobile carousel has no images. Use the web carousel below for the desktop site.
              </p>

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
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-[#3f4738]">Web homepage carousel</p>
                <p className="text-sm leading-6 text-[#667056]">
                  Add 3 to 6 desktop images for the web home hero. Slides change automatically with no dots or controls.
                </p>
              </div>

              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  const remainingSlots = Math.max(0, 6 - savedDesktopHeroSlides.length - desktopHeroFiles.length);
                  setDesktopHeroFiles((current) => [...current, ...files.slice(0, remainingSlots)]);
                  event.currentTarget.value = "";
                }}
                className="mt-4 block w-full text-sm text-[#667056] file:mr-4 file:rounded-full file:border-0 file:bg-[#5e684f] file:px-4 file:py-2 file:text-xs file:font-semibold file:tracking-[0.08em] file:text-[#fbf4e8]"
              />

              <div className="mt-4 space-y-3">
                {savedDesktopHeroSlides.map((slide, index) => (
                  <div
                    key={slide.imagePath || slide.imageUrl || index}
                    className="flex items-center gap-3 rounded-[1rem] border border-[#e3d8c9] bg-[#fbf7ef] p-3"
                  >
                    <div
                      className="h-14 w-20 shrink-0 rounded-[0.8rem] bg-[#efe5d7] bg-cover bg-center"
                      style={{ backgroundImage: `url('${slide.imageUrl}')` }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#3f4738]">Web slide {index + 1}</p>
                      <p className="mt-1 truncate text-xs text-[#7a7d74]">{slide.imageAlt || "Homepage image"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setForm((current) => ({
                          ...current,
                          desktopHeroSlides: normalizeMobileHomeHeroSlides(current.desktopHeroSlides).filter(
                            (_, slideIndex) => slideIndex !== index
                          )
                        }));
                        if (slide.imagePath) {
                          setDesktopHeroRemovedPaths((current) => [...current, slide.imagePath ?? ""]);
                        }
                      }}
                      className="text-xs font-medium text-[#9d4b45] transition-opacity duration-200 hover:opacity-80"
                    >
                      Remove
                    </button>
                  </div>
                ))}

                {desktopHeroFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between rounded-[1rem] border border-dashed border-[#d8cbb7] bg-[#fbf7ef] px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#3f4738]">Pending web image</p>
                      <p className="mt-1 text-xs text-[#7a7d74]">{file.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDesktopHeroFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))
                      }
                      className="text-xs font-medium text-[#9d4b45] transition-opacity duration-200 hover:opacity-80"
                    >
                      Remove
                    </button>
                  </div>
                ))}

                {savedDesktopHeroSlides.length === 0 && desktopHeroFiles.length === 0 ? (
                  <p className="text-sm text-[#7a7d74]">No web carousel images added yet. The local fallback image will remain visible.</p>
                ) : null}
              </div>
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

            <div className="rounded-[1.2rem] border border-[#e3d8c9] bg-white/65 p-4">
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-[#3f4738]">PWA mobile home carousel</p>
                <p className="text-sm leading-6 text-[#667056]">
                  Add 3 to 6 mobile-only hero images for the `/app` home carousel. This does not affect the web home page.
                </p>
              </div>

              <div className="mt-4 rounded-[1rem] border border-[#e3d8c9] bg-[#fbf7ef] p-4">
                <p className="text-sm font-semibold text-[#3f4738]">PWA mobile overlay message</p>
                <p className="mt-1 text-sm leading-6 text-[#667056]">
                  This text appears on the PWA home hero only and does not affect the web home overlay.
                </p>

                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-medium text-[#4f5942]">Eyebrow</span>
                  <input
                    value={form.mobileLaunchEyebrow}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, mobileLaunchEyebrow: event.target.value }))
                    }
                    className={inputClassName}
                    placeholder="OPENING SHORTLY"
                  />
                </label>

                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-medium text-[#4f5942]">Heading</span>
                  <textarea
                    value={form.mobileLaunchHeading}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, mobileLaunchHeading: event.target.value }))
                    }
                    className={textAreaClassName}
                    rows={3}
                    placeholder="Timeless Sarees, thoughtfully yours"
                  />
                </label>

                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-medium text-[#4f5942]">Body copy</span>
                  <textarea
                    value={form.mobileLaunchBody}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, mobileLaunchBody: event.target.value }))
                    }
                    className={textAreaClassName}
                    rows={4}
                    placeholder="Handpicked drapes in mul cotton, tissue and more. Soft on you, perfect for every occasion."
                  />
                </label>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[#4f5942]">Button text</span>
                    <input
                      value={form.mobileLaunchButtonLabel}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, mobileLaunchButtonLabel: event.target.value }))
                      }
                      className={inputClassName}
                      placeholder="SHOP SAREES"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[#4f5942]">Button link</span>
                    <input
                      value={form.mobileLaunchButtonHref}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, mobileLaunchButtonHref: event.target.value }))
                      }
                      className={inputClassName}
                      placeholder="/app/search/"
                    />
                  </label>
                </div>
              </div>

              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  const remainingSlots = Math.max(0, 6 - savedMobileHeroSlides.length - mobileHeroFiles.length);
                  setMobileHeroFiles((current) => [...current, ...files.slice(0, remainingSlots)]);
                  event.currentTarget.value = "";
                }}
                className="mt-4 block w-full text-sm text-[#667056] file:mr-4 file:rounded-full file:border-0 file:bg-[#5e684f] file:px-4 file:py-2 file:text-xs file:font-semibold file:tracking-[0.08em] file:text-[#fbf4e8]"
              />

              <div className="mt-4 space-y-3">
                {savedMobileHeroSlides.map((slide, index) => (
                  <div key={slide.imagePath || slide.imageUrl || index} className="rounded-[1rem] border border-[#e3d8c9] bg-[#fbf7ef] p-3">
                    <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
                      <div
                        className="aspect-[0.8] rounded-[0.9rem] bg-[#efe5d7] bg-cover bg-center"
                        style={{
                          backgroundImage: `url('${slide.imageUrl}')`,
                          backgroundPosition: slide.position || "center"
                        }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[#3f4738]">Mobile slide {index + 1}</p>
                            <p className="mt-1 text-xs text-[#7a7d74]">{slide.imageAlt || "PWA home image"}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setForm((current) => ({
                                ...current,
                                mobileHeroSlides: normalizeMobileHomeHeroSlides(current.mobileHeroSlides).filter((_, slideIndex) => slideIndex !== index)
                              }));
                              if (slide.imagePath) {
                                setMobileHeroRemovedPaths((current) => [...current, slide.imagePath ?? ""]);
                              }
                            }}
                            className="text-xs font-medium text-[#9d4b45] transition-opacity duration-200 hover:opacity-80"
                          >
                            Remove
                          </button>
                        </div>

                        <label className="mt-3 block">
                          <span className="mb-2 block text-xs font-medium text-[#4f5942]">Image position</span>
                          <input
                            value={slide.position || ""}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                mobileHeroSlides: normalizeMobileHomeHeroSlides(current.mobileHeroSlides).map((entry, slideIndex) =>
                                  slideIndex === index
                                    ? {
                                        ...entry,
                                        position: event.target.value
                                      }
                                    : entry
                                )
                              }))
                            }
                            className={inputClassName}
                            placeholder="center"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ))}

                {mobileHeroFiles.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-[1rem] border border-dashed border-[#d8cbb7] bg-[#fbf7ef] px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-[#3f4738]">Pending mobile image</p>
                      <p className="mt-1 text-xs text-[#7a7d74]">{file.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setMobileHeroFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))
                      }
                      className="text-xs font-medium text-[#9d4b45] transition-opacity duration-200 hover:opacity-80"
                    >
                      Remove
                    </button>
                  </div>
                ))}

                {savedMobileHeroSlides.length === 0 && mobileHeroFiles.length === 0 ? (
                  <p className="text-sm text-[#7a7d74]">No mobile-only carousel images added yet.</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-[1rem] border border-dashed border-[#d8cbb7] bg-white/70 p-4">
            <div>
              <p className="text-sm font-medium text-[#4f5942]">PWA fallback preview</p>
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

            <div>
              <p className="text-sm font-medium text-[#4f5942]">PWA mobile carousel preview</p>
              <div className="mt-4 rounded-[1.6rem] border border-[#e3d8c9] bg-[#fffaf2] p-3">
                <div className="relative overflow-hidden rounded-[1.2rem]">
                  <div
                    className="aspect-[0.92] w-full bg-[#efe5d7] bg-cover bg-center"
                    style={{
                      backgroundImage: savedMobileHeroSlides[0]?.imageUrl
                        ? `url('${savedMobileHeroSlides[0]?.imageUrl}')`
                        : form.heroImageUrl
                          ? `url('${form.heroImageUrl}')`
                          : "linear-gradient(180deg, #efe5d7 0%, #d6c7b2 100%)",
                      backgroundPosition:
                        savedMobileHeroSlides[0]?.position ||
                        form.heroImagePosition ||
                        DEFAULT_HOME_PAGE_CONTENT.heroImagePosition
                    }}
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(102deg,rgba(251,244,232,0.96)_4%,rgba(251,244,232,0.88)_34%,rgba(251,244,232,0.18)_68%,rgba(251,244,232,0.02)_100%)]" />
                  <div className="absolute inset-0 flex flex-col p-4">
                    <div className="max-w-[15rem]">
                      <p className="font-serif text-[1.55rem] leading-[1.05] text-[#354233]">
                        {form.mobileLaunchHeading || "Timeless Sarees, thoughtfully yours"}
                      </p>
                      <p className="mt-3 text-[0.82rem] leading-6 text-[#61705d]">
                        {form.mobileLaunchBody ||
                          "Handpicked drapes in mul cotton, tissue and more. Soft on you, perfect for every occasion."}
                      </p>
                    </div>
                    <div className="mt-auto">
                      <div className="mb-3 flex items-center gap-3 text-[0.52rem] font-semibold uppercase tracking-[0.22em] text-[#9b885f]">
                        <span>{form.mobileLaunchEyebrow || "OPENING SHORTLY"}</span>
                        <span className="h-px flex-1 bg-[#d7c4a2]" />
                      </div>
                      <div className="inline-flex rounded-[0.95rem] bg-[#5e684f] px-4 py-2.5 text-[0.58rem] font-semibold tracking-[0.14em] text-[#fbf4e8]">
                        {form.mobileLaunchButtonLabel || "SHOP SAREES"}
                      </div>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-sm text-[#667056]">
                  {savedMobileHeroSlides.length > 0
                    ? `${savedMobileHeroSlides.length} mobile image${savedMobileHeroSlides.length === 1 ? "" : "s"} configured.`
                    : "Falls back to the default home hero until mobile images are added."}
                </p>
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
