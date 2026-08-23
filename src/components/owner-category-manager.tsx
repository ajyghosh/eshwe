"use client";

import { useEffect, useMemo, useState } from "react";

import { ConfirmationDialog } from "@/components/confirmation-dialog";
import {
  createCategoryCard,
  deleteCategoryCard,
  subscribeToCategoryCards,
  updateCategoryCard
} from "@/lib/homepage";
import { subscribeToProductGroups } from "@/lib/product-groups";
import { slugifySareeName } from "@/lib/sarees";
import { deleteSareeImages, uploadSiteAsset } from "@/lib/storage";
import type { CategoryCard } from "@/types/homepage";
import type { ProductGroup } from "@/types/product-group";

type CategoryFormState = {
  title: string;
  imageUrl: string;
  imagePath: string;
  shopFilter: string;
  backgroundPosition: string;
  active: boolean;
  sortOrder: string;
};

const defaultForm: CategoryFormState = {
  title: "",
  imageUrl: "",
  imagePath: "",
  shopFilter: "",
  backgroundPosition: "center",
  active: true,
  sortOrder: "1"
};

export function OwnerCategoryManager() {
  const [cards, setCards] = useState<CategoryCard[]>([]);
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryFormState>(defaultForm);
  const [pendingDeleteCard, setPendingDeleteCard] = useState<CategoryCard | null>(null);

  useEffect(() => {
    return subscribeToCategoryCards((nextCards) => {
      setCards(nextCards);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    return subscribeToProductGroups((nextGroups) => {
      setProductGroups(nextGroups);
    });
  }, []);

  const nextSortOrder = useMemo(() => {
    if (cards.length === 0) {
      return 1;
    }

    return Math.max(...cards.map((card) => card.sortOrder || 0)) + 1;
  }, [cards]);

  function resetForm() {
    setEditingId(null);
    setImageFile(null);
    setError(null);
    setForm({
      ...defaultForm,
      sortOrder: String(nextSortOrder)
    });
  }

  useEffect(() => {
    setForm((current) =>
      current === defaultForm || (!editingId && current.title === "" && current.sortOrder === "1")
        ? { ...defaultForm, sortOrder: String(nextSortOrder) }
        : current
    );
  }, [editingId, nextSortOrder]);

  function beginEditing(card: CategoryCard) {
    setEditingId(card.id ?? null);
    setImageFile(null);
    setError(null);
    setForm({
      title: card.title,
      imageUrl: card.imageUrl,
      imagePath: card.imagePath ?? "",
      shopFilter: card.shopFilter ?? "",
      backgroundPosition: card.backgroundPosition || "center",
      active: card.active,
      sortOrder: String(card.sortOrder)
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      if (!form.title.trim()) {
        throw new Error("Category title is required.");
      }

      let imageUrl = form.imageUrl;
      let imagePath = form.imagePath;

      if (imageFile) {
        const upload = await uploadSiteAsset(imageFile, `categories/${slugifySareeName(form.title)}`);

        if (editingId && imagePath) {
          await deleteSareeImages([imagePath]);
        }

        imageUrl = upload.url;
        imagePath = upload.path;
      }

      if (!editingId && !imageUrl) {
        throw new Error("A category image is required.");
      }

      const payload = {
        title: form.title.trim(),
        imageUrl,
        imagePath,
        shopFilter: form.shopFilter.trim() || form.title.trim(),
        backgroundPosition: form.backgroundPosition.trim() || "center",
        active: form.active,
        sortOrder: Number(form.sortOrder) || nextSortOrder
      };

      if (editingId) {
        await updateCategoryCard(editingId, payload);
      } else {
        await createCategoryCard(payload);
      }

      resetForm();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Saving category card failed.");
    } finally {
      setIsSaving(false);
    }
  }

  function requestDelete(card: CategoryCard) {
    if (!card.id) {
      return;
    }

    setPendingDeleteCard(card);
  }

  async function confirmDelete() {
    if (!pendingDeleteCard?.id) {
      return;
    }

    setIsDeletingId(pendingDeleteCard.id);
    setError(null);

    try {
      if (pendingDeleteCard.imagePath) {
        await deleteSareeImages([pendingDeleteCard.imagePath]);
      }

      await deleteCategoryCard(pendingDeleteCard.id);

      if (editingId === pendingDeleteCard.id) {
        resetForm();
      }
      setPendingDeleteCard(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Deleting category card failed.");
    } finally {
      setIsDeletingId(null);
    }
  }

  return (
    <section className="rounded-[1.8rem] border border-[#e3d8c9] bg-white/70 p-7 sm:p-8">
      <div className="flex flex-col gap-3">
        <h2 className="brand-copy text-3xl text-[#3f4738]">Category carousel</h2>
        <p className="text-sm leading-7 text-[#667056]">
          Control the cards shown in the homepage category slider, including their images and order.
        </p>
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#4f5942]">Title</span>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className={inputClassName}
              placeholder="Temple Borders"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#4f5942]">Shop filter term</span>
            <input
              value={form.shopFilter}
              onChange={(event) =>
                setForm((current) => ({ ...current, shopFilter: event.target.value }))
              }
              list="owner-product-group-suggestions"
              className={inputClassName}
              placeholder="Mul Cotton"
            />
            <span className="mt-2 block text-xs leading-6 text-[#667056]">
              Used when this card opens the shop page. Match this with a product group for cleaner filtering.
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#4f5942]">Background position</span>
              <input
                value={form.backgroundPosition}
                onChange={(event) =>
                  setForm((current) => ({ ...current, backgroundPosition: event.target.value }))
                }
                className={inputClassName}
                placeholder="center 68%"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#4f5942]">Sort order</span>
              <input
                value={form.sortOrder}
                onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))}
                className={inputClassName}
                inputMode="numeric"
                placeholder={String(nextSortOrder)}
              />
            </label>
          </div>

          <label className="flex h-[52px] items-center gap-3 rounded-[1rem] border border-[#d9ccb8] bg-[#f8f0e3] px-4 text-sm text-[#3f4738]">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
              className="h-4 w-4 accent-[#5e684f]"
            />
            Show this category on the homepage
          </label>

          <div className="rounded-[1rem] border border-dashed border-[#d8cbb7] bg-[#f8f0e3] p-4">
            {form.imageUrl ? (
              <div
                className="mb-4 aspect-[0.92] w-full rounded-[1rem] bg-cover bg-center"
                style={{
                  backgroundImage: `url('${form.imageUrl}')`,
                  backgroundPosition: form.backgroundPosition || "center"
                }}
              />
            ) : null}

            <input
              type="file"
              accept="image/*"
              onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-[#667056] file:mr-4 file:rounded-full file:border-0 file:bg-[#5e684f] file:px-4 file:py-2 file:text-xs file:font-semibold file:tracking-[0.08em] file:text-[#fbf4e8]"
            />
          </div>

          <datalist id="owner-product-group-suggestions">
            {productGroups.map((group) => (
              <option key={group.id ?? group.name} value={group.name} />
            ))}
          </datalist>

          {error ? <p className="text-sm text-[#9d4b45]">{error}</p> : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="brand-caption rounded-2xl bg-[#5e684f] px-6 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#fbf4e8] disabled:opacity-60"
            >
              {isSaving ? "SAVING..." : editingId ? "UPDATE CATEGORY" : "ADD CATEGORY"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="brand-caption rounded-2xl border border-[#d1c3ae] px-6 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#5e684f]"
              >
                CANCEL EDIT
              </button>
            ) : null}
          </div>
        </form>

        <div className="space-y-4">
          {loading ? (
            <p className="text-sm text-[#667056]">Loading category cards…</p>
          ) : cards.length === 0 ? (
            <div className="rounded-[1.4rem] border border-dashed border-[#d8cbb7] bg-[#f8f0e3] p-5 text-sm leading-7 text-[#667056]">
              No category cards yet. Add at least one to publish categories on the storefront.
            </div>
          ) : (
            cards.map((card) => (
              <article
                key={card.id}
                className="rounded-[1.3rem] border border-[#e8dccd] bg-[#f8f0e3] p-4 shadow-[0_10px_25px_rgba(94,104,79,0.05)]"
              >
                <div className="flex gap-4">
                  <div
                    className="h-24 w-20 shrink-0 rounded-[0.9rem] bg-cover bg-center"
                    style={{
                      backgroundImage: card.imageUrl
                        ? `url('${card.imageUrl}')`
                        : "linear-gradient(180deg, #ede7dc 0%, #b8b0a6 100%)",
                      backgroundPosition: card.backgroundPosition || "center"
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="brand-copy text-xl text-[#3f4738]">{card.title}</h3>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${
                          card.active ? "bg-[#dfe9d6] text-[#4d6a41]" : "bg-[#ece7dd] text-[#6b665f]"
                        }`}
                      >
                        {card.active ? "Active" : "Hidden"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[#667056]">
                      Position: {card.backgroundPosition || "center"} · Order: {card.sortOrder}
                    </p>
                    <p className="mt-1 text-sm text-[#667056]">Shop filter: {card.shopFilter || card.title}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => beginEditing(card)}
                        className="brand-caption rounded-full bg-[#5e684f] px-4 py-2 text-[0.52rem] font-semibold tracking-[0.08em] text-[#fbf4e8]"
                      >
                        EDIT
                      </button>
                      <button
                        type="button"
                        onClick={() => requestDelete(card)}
                        disabled={isDeletingId === card.id}
                        className="brand-caption rounded-full border border-[#d4c5b2] px-4 py-2 text-[0.52rem] font-semibold tracking-[0.08em] text-[#9d4b45] disabled:opacity-60"
                      >
                        {isDeletingId === card.id ? "DELETING..." : "DELETE"}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      <ConfirmationDialog
        open={Boolean(pendingDeleteCard)}
        title="Delete category carousel card?"
        message={
          pendingDeleteCard
            ? `${pendingDeleteCard.title} will be removed from the homepage category slider and its uploaded card image will also be deleted.`
            : ""
        }
        confirmLabel="DELETE CARD"
        pending={Boolean(pendingDeleteCard?.id && isDeletingId === pendingDeleteCard.id)}
        onConfirm={confirmDelete}
        onClose={() => setPendingDeleteCard(null)}
      />
    </section>
  );
}

const inputClassName =
  "h-[52px] w-full rounded-[1rem] border border-[#d9ccb8] bg-white/70 px-4 text-sm text-[#3f4738] outline-none transition-colors duration-200 placeholder:text-[#948978] focus:border-[#5e684f]";
