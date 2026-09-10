"use client";

import { useEffect, useMemo, useState } from "react";

import { ConfirmationDialog } from "@/components/owner-confirmation-dialog";
import {
  createProductMasterOption,
  deleteProductMasterOption,
  subscribeToProductMasterOptions,
  updateProductMasterOption
} from "@/lib/product-master-options";
import type { ProductMasterField, ProductMasterOption } from "@/types/product-master-option";

type ProductMasterFormState = {
  type: ProductMasterField;
  value: string;
  active: boolean;
  sortOrder: string;
};

const fieldConfigs: Array<{
  type: ProductMasterField;
  title: string;
  placeholder: string;
}> = [
  { type: "fabric", title: "Fabrics", placeholder: "Mul Cotton" },
  { type: "color", title: "Colors", placeholder: "Berry Rose" },
  { type: "collection_label", title: "Collection Labels", placeholder: "Medha Collection" }
];

const defaultForm: ProductMasterFormState = {
  type: "fabric",
  value: "",
  active: true,
  sortOrder: "1"
};

export function OwnerProductMasterManager() {
  const [options, setOptions] = useState<ProductMasterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ProductMasterFormState>(defaultForm);
  const [pendingDeleteOption, setPendingDeleteOption] = useState<ProductMasterOption | null>(null);

  useEffect(() => {
    return subscribeToProductMasterOptions((nextOptions) => {
      setOptions(nextOptions);
      setLoading(false);
    });
  }, []);

  const groupedOptions = useMemo(() => {
    return fieldConfigs.map((config) => ({
      ...config,
      items: options.filter((option) => option.type === config.type)
    }));
  }, [options]);

  const nextSortOrder = useMemo(() => {
    const sameTypeOptions = options.filter((option) => option.type === form.type);

    if (sameTypeOptions.length === 0) {
      return 1;
    }

    return Math.max(...sameTypeOptions.map((option) => option.sortOrder || 0)) + 1;
  }, [form.type, options]);

  useEffect(() => {
    if (!editingId && form.value === "") {
      setForm((current) => ({ ...current, sortOrder: String(nextSortOrder) }));
    }
  }, [editingId, form.value, nextSortOrder]);

  function resetForm() {
    setEditingId(null);
    setError(null);
    setForm({
      ...defaultForm,
      type: form.type,
      sortOrder: String(nextSortOrder)
    });
  }

  function beginEditing(option: ProductMasterOption) {
    setEditingId(option.id ?? null);
    setError(null);
    setForm({
      type: option.type,
      value: option.value,
      active: option.active,
      sortOrder: String(option.sortOrder)
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      if (!form.value.trim()) {
        throw new Error("Master data value is required.");
      }

      const payload = {
        type: form.type,
        value: form.value.trim(),
        active: form.active,
        sortOrder: Number(form.sortOrder) || nextSortOrder
      };

      if (editingId) {
        await updateProductMasterOption(editingId, payload);
      } else {
        await createProductMasterOption(payload);
      }

      resetForm();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Saving master data failed.");
    } finally {
      setIsSaving(false);
    }
  }

  function requestDelete(option: ProductMasterOption) {
    if (!option.id) {
      return;
    }

    setPendingDeleteOption(option);
  }

  async function confirmDelete() {
    if (!pendingDeleteOption?.id) {
      return;
    }

    setIsDeletingId(pendingDeleteOption.id);
    setError(null);

    try {
      await deleteProductMasterOption(pendingDeleteOption.id);

      if (editingId === pendingDeleteOption.id) {
        resetForm();
      }
      setPendingDeleteOption(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Deleting master data failed.");
    } finally {
      setIsDeletingId(null);
    }
  }

  return (
    <section className="rounded-[1.8rem] border border-[#e3d8c9] bg-white/70 p-7 sm:p-8">
      <div className="flex flex-col gap-3">
        <h2 className="brand-copy text-3xl text-[#3f4738]">Product master data</h2>
        <p className="text-sm leading-7 text-[#667056]">
          Manage dropdown values for fabric, color, and collection label. Categories are handled separately in Product groups.
        </p>
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#4f5942]">Field</span>
            <select
              value={form.type}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  type: event.target.value as ProductMasterField,
                  sortOrder: String(nextSortOrder),
                  value: editingId ? current.value : ""
                }))
              }
              className={inputClassName}
            >
              {fieldConfigs.map((config) => (
                <option key={config.type} value={config.type}>
                  {config.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#4f5942]">Value</span>
            <input
              value={form.value}
              onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))}
              className={inputClassName}
              placeholder={fieldConfigs.find((config) => config.type === form.type)?.placeholder ?? "Enter value"}
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
                Active option
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={isSaving}
              className="brand-caption rounded-2xl bg-[#5e684f] px-6 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#fbf4e8] disabled:opacity-60"
            >
              {isSaving ? "SAVING..." : editingId ? "UPDATE VALUE" : "CREATE VALUE"}
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

        <div className="space-y-5">
          {loading ? (
            <p className="text-sm text-[#667056]">Loading master data…</p>
          ) : (
            groupedOptions.map((group) => (
              <section key={group.type} className="rounded-[1.3rem] border border-[#e5d8c8] bg-[#fbf4e8] p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="brand-copy text-2xl text-[#3f4738]">{group.title}</h3>
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-[#667056]">
                    {group.items.length} option{group.items.length === 1 ? "" : "s"}
                  </span>
                </div>

                {group.items.length === 0 ? (
                  <p className="mt-4 text-sm leading-7 text-[#667056]">No values added yet.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {group.items.map((option) => (
                      <article
                        key={option.id ?? `${option.type}-${option.value}`}
                        className="flex flex-col gap-3 rounded-[1.1rem] border border-[#e8dccd] bg-white/72 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-sm font-semibold text-[#3f4738]">{option.value}</p>
                          <p className="mt-1 text-xs text-[#667056]">
                            Order {option.sortOrder} · {option.active ? "Active" : "Hidden"}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => beginEditing(option)}
                            className="brand-caption rounded-full bg-[#5e684f] px-4 py-2 text-[0.52rem] font-semibold tracking-[0.08em] text-[#fbf4e8]"
                          >
                            EDIT
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDelete(option)}
                            disabled={isDeletingId === option.id}
                            className="brand-caption rounded-full border border-[#d4c5b2] px-4 py-2 text-[0.52rem] font-semibold tracking-[0.08em] text-[#9d4b45] disabled:opacity-60"
                          >
                            {isDeletingId === option.id ? "DELETING..." : "DELETE"}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ))
          )}
        </div>
      </div>

      <ConfirmationDialog
        open={Boolean(pendingDeleteOption)}
        title="Delete master data value?"
        message={
          pendingDeleteOption
            ? `${pendingDeleteOption.value} will be removed from the dropdown options across the owner panel.`
            : ""
        }
        confirmLabel="DELETE VALUE"
        pending={Boolean(pendingDeleteOption?.id && isDeletingId === pendingDeleteOption.id)}
        onConfirm={confirmDelete}
        onClose={() => setPendingDeleteOption(null)}
      />
    </section>
  );
}

const inputClassName =
  "h-[52px] w-full rounded-[1rem] border border-[#d9ccb8] bg-white/80 px-4 text-sm text-[#4f5942] outline-none transition-colors duration-200 focus:border-[#5e684f]";
