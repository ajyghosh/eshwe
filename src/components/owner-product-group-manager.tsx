"use client";

import { useEffect, useMemo, useState } from "react";

import { ConfirmationDialog } from "@/components/owner-confirmation-dialog";
import {
  createProductGroup,
  deleteProductGroup,
  subscribeToProductGroups,
  updateProductGroup
} from "@/lib/product-groups";
import type { ProductGroup } from "@/types/product-group";

type ProductGroupFormState = {
  name: string;
  active: boolean;
  sortOrder: string;
};

const defaultForm: ProductGroupFormState = {
  name: "",
  active: true,
  sortOrder: "1"
};

export function OwnerProductGroupManager() {
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ProductGroupFormState>(defaultForm);
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<ProductGroup | null>(null);

  useEffect(() => {
    return subscribeToProductGroups((nextGroups) => {
      setGroups(nextGroups);
      setLoading(false);
    });
  }, []);

  const nextSortOrder = useMemo(() => {
    if (groups.length === 0) {
      return 1;
    }

    return Math.max(...groups.map((group) => group.sortOrder || 0)) + 1;
  }, [groups]);

  useEffect(() => {
    if (!editingId && form.name === "") {
      setForm((current) => ({ ...current, sortOrder: String(nextSortOrder) }));
    }
  }, [editingId, form.name, nextSortOrder]);

  function resetForm() {
    setEditingId(null);
    setError(null);
    setForm({
      ...defaultForm,
      sortOrder: String(nextSortOrder)
    });
  }

  function beginEditing(group: ProductGroup) {
    setEditingId(group.id ?? null);
    setError(null);
    setForm({
      name: group.name,
      active: group.active,
      sortOrder: String(group.sortOrder)
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      if (!form.name.trim()) {
        throw new Error("Product group name is required.");
      }

      const payload = {
        name: form.name.trim(),
        active: form.active,
        sortOrder: Number(form.sortOrder) || nextSortOrder
      };

      if (editingId) {
        await updateProductGroup(editingId, payload);
      } else {
        await createProductGroup(payload);
      }

      resetForm();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Saving product group failed.");
    } finally {
      setIsSaving(false);
    }
  }

  function requestDelete(group: ProductGroup) {
    if (!group.id) {
      return;
    }

    setPendingDeleteGroup(group);
  }

  async function confirmDelete() {
    if (!pendingDeleteGroup?.id) {
      return;
    }

    setIsDeletingId(pendingDeleteGroup.id);
    setError(null);

    try {
      await deleteProductGroup(pendingDeleteGroup.id);

      if (editingId === pendingDeleteGroup.id) {
        resetForm();
      }
      setPendingDeleteGroup(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Deleting product group failed.");
    } finally {
      setIsDeletingId(null);
    }
  }

  return (
    <section className="rounded-[1.8rem] border border-[#e3d8c9] bg-white/70 p-7 sm:p-8">
      <div className="flex flex-col gap-3">
        <h2 className="brand-copy text-3xl text-[#3f4738]">Category master data</h2>
        <p className="text-sm leading-7 text-[#667056]">
          Manage the category dropdown used while creating products. This remains separate from the homepage category carousel.
        </p>
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#4f5942]">Group name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className={inputClassName}
              placeholder="Mul Cotton"
              required
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
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

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#4f5942]">Status</span>
              <span className="flex h-[52px] items-center gap-3 rounded-[1rem] border border-[#d9ccb8] bg-[#f8f0e3] px-4 text-sm text-[#3f4738]">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                  className="h-4 w-4 accent-[#5e684f]"
                />
                Active group
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={isSaving}
              className="brand-caption rounded-2xl bg-[#5e684f] px-6 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#fbf4e8] disabled:opacity-60"
            >
              {isSaving ? "SAVING..." : editingId ? "UPDATE GROUP" : "CREATE GROUP"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="brand-caption rounded-2xl border border-[#d1c3ae] px-6 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#5e684f]"
            >
              {editingId ? "CANCEL EDIT" : "CLEAR"}
            </button>
          </div>

          {error ? <p className="text-sm text-[#9d4b45]">{error}</p> : null}
        </form>

        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-[#667056]">Loading product groups…</p>
          ) : groups.length === 0 ? (
            <div className="rounded-[1.3rem] border border-dashed border-[#d8cbb7] bg-[#fbf4e8] p-5 text-sm leading-7 text-[#667056]">
              No product groups yet. Add groups here, then use them while creating products and category cards.
            </div>
          ) : (
            groups.map((group) => (
              <article
                key={group.id ?? group.name}
                className="rounded-[1.3rem] border border-[#e5d8c8] bg-[#fbf4e8] p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="brand-copy text-2xl text-[#3f4738]">{group.name}</h3>
                    <p className="mt-1 text-sm text-[#667056]">
                      Order {group.sortOrder} · {group.active ? "Active" : "Hidden"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => beginEditing(group)}
                      className="brand-caption rounded-full bg-[#5e684f] px-4 py-2 text-[0.52rem] font-semibold tracking-[0.08em] text-[#fbf4e8]"
                    >
                      EDIT
                    </button>
                    <button
                      type="button"
                      onClick={() => requestDelete(group)}
                      disabled={isDeletingId === group.id}
                      className="brand-caption rounded-full border border-[#d4c5b2] px-4 py-2 text-[0.52rem] font-semibold tracking-[0.08em] text-[#9d4b45] disabled:opacity-60"
                    >
                      {isDeletingId === group.id ? "DELETING..." : "DELETE"}
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      <ConfirmationDialog
        open={Boolean(pendingDeleteGroup)}
        title="Delete category master data?"
        message={
          pendingDeleteGroup
            ? `${pendingDeleteGroup.name} will be removed from the category master list used in product creation.`
            : ""
        }
        confirmLabel="DELETE GROUP"
        pending={Boolean(pendingDeleteGroup?.id && isDeletingId === pendingDeleteGroup.id)}
        onConfirm={confirmDelete}
        onClose={() => setPendingDeleteGroup(null)}
      />
    </section>
  );
}

const inputClassName =
  "h-[52px] w-full rounded-[1rem] border border-[#d9ccb8] bg-white/80 px-4 text-sm text-[#4f5942] outline-none transition-colors duration-200 focus:border-[#5e684f]";
