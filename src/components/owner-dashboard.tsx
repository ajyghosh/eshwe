"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";

import { OwnerBackofficeNav } from "@/components/owner-backoffice-nav";
import { OwnerSectionHero } from "@/components/owner-section-hero";
import {
  isPrimaryOwnerEmail,
  normalizeEmail,
  signInAsOwner,
  signOutOwner,
  subscribeToAuth
} from "@/lib/auth";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { seedDummyCatalogue } from "@/lib/dummy-catalogue";
import {
  defaultDryingTips,
  defaultProductLength,
  defaultProductNote,
  defaultSareeCareTips,
  defaultWashCare
} from "@/lib/product-detail-defaults";
import { subscribeToProductMasterOptions } from "@/lib/product-master-options";
import { subscribeToProductGroups } from "@/lib/product-groups";
import {
  createSaree,
  deleteSaree,
  slugifySareeName,
  subscribeToSarees,
  updateSaree
} from "@/lib/sarees";
import { subscribeToCustomerMessages } from "@/lib/customer-messages";
import { deleteSareeImages, uploadSareeImage } from "@/lib/storage";
import { subscribeToWaitlistEntries } from "@/lib/waitlist";
import {
  normalizeOwnerEmail,
  subscribeToOwnerAccounts,
  type OwnerAccount
} from "@/lib/owner-access";
import { firebaseReady } from "@/lib/firebase";
import { DEFAULT_AVAILABLE_STOCK, getEffectiveAvailabilityStatus, normalizeAvailableStock } from "@/lib/inventory";
import { formatOccasionSummary, MANUAL_OCCASION_TAGS, normalizeOccasionTags } from "@/lib/product-discovery";
import type { ProductMasterOption } from "@/types/product-master-option";
import type { ProductGroup } from "@/types/product-group";
import type { Saree, SareeStatus } from "@/types/saree";

type GalleryImage = {
  path?: string | null;
  url: string;
};

type ProductFormState = {
  name: string;
  slug: string;
  sku: string;
  category: string;
  fabric: string;
  color: string;
  description: string;
  price: string;
  originalPrice: string;
  discountPercent: string;
  collectionLabel: string;
  occasionTags: string[];
  availableStock: string;
  status: SareeStatus;
  featured: boolean;
  primaryImageUrl: string;
  primaryImagePath: string;
  galleryImages: GalleryImage[];
  length: string;
  washCare: string;
  productNote: string;
  sareeCareTips: string;
  dryingTips: string;
};

export function OwnerDashboard() {
  const router = useRouter();
  const [dialogState, setDialogState] = useState<
    | { type: "signout" }
    | { type: "delete-product"; product: Saree }
    | { type: "seed-dummy" }
    | null
  >(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Saree[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productMasterOptions, setProductMasterOptions] = useState<ProductMasterOption[]>([]);
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [ownerAccounts, setOwnerAccounts] = useState<OwnerAccount[]>([]);
  const [ownerAccountsLoading, setOwnerAccountsLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [ownerAccessError, setOwnerAccessError] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [customerMessageCount, setCustomerMessageCount] = useState(0);
  const [customerMessagesLoading, setCustomerMessagesLoading] = useState(true);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [waitlistLoading, setWaitlistLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [isSeedingDummy, setIsSeedingDummy] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [primaryImageFile, setPrimaryImageFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [removedGalleryPaths, setRemovedGalleryPaths] = useState<string[]>([]);
  const [form, setForm] = useState<ProductFormState>(createEmptyForm());
  const autoDiscountPreview = calculateDiscountPercent(form.price, form.originalPrice);

  useEffect(() => {
    return subscribeToAuth((nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    return subscribeToSarees(
      (nextProducts) => {
        setProducts(nextProducts);
        setProductsLoading(false);
      },
      {},
      (error) => {
        setReadError(error.message);
        setProductsLoading(false);
      }
    );
  }, []);

  useEffect(() => {
    return subscribeToProductGroups((nextGroups) => {
      setProductGroups(nextGroups);
    });
  }, []);

  useEffect(() => {
    return subscribeToProductMasterOptions((nextOptions) => {
      setProductMasterOptions(nextOptions);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setOwnerAccounts([]);
      setOwnerAccountsLoading(false);
      setOwnerAccessError(null);
      return;
    }

    setOwnerAccountsLoading(true);

    return subscribeToOwnerAccounts(
      (nextOwners) => {
        setOwnerAccounts(nextOwners);
        setOwnerAccountsLoading(false);
      },
      (error) => {
        setOwnerAccounts([]);
        setOwnerAccountsLoading(false);
        setOwnerAccessError(error.message);
      }
    );
  }, [user]);

  const normalizedUserEmail = normalizeEmail(user?.email);
  const ownerAuthorized =
    isPrimaryOwnerEmail(user?.email) ||
    ownerAccounts.some((owner) => normalizeOwnerEmail(owner.email) === normalizedUserEmail);

  useEffect(() => {
    if (!user || !ownerAuthorized) {
      setCustomerMessageCount(0);
      setCustomerMessagesLoading(false);
      return;
    }

    setCustomerMessagesLoading(true);

    return subscribeToCustomerMessages(
      (messages) => {
        setCustomerMessageCount(messages.length);
        setCustomerMessagesLoading(false);
      },
      () => {
        setCustomerMessageCount(0);
        setCustomerMessagesLoading(false);
      }
    );
  }, [ownerAuthorized, user]);

  useEffect(() => {
    if (!user || !ownerAuthorized) {
      setWaitlistCount(0);
      setWaitlistLoading(false);
      return;
    }

    setWaitlistLoading(true);

    return subscribeToWaitlistEntries(
      (entries) => {
        setWaitlistCount(entries.length);
        setWaitlistLoading(false);
      },
      () => {
        setWaitlistCount(0);
        setWaitlistLoading(false);
      }
    );
  }, [ownerAuthorized, user]);

  const categoryOptions = useMemo(
    () => buildDropdownOptions(productGroups.filter((group) => group.active).map((group) => group.name), form.category),
    [form.category, productGroups]
  );
  const fabricOptions = useMemo(
    () =>
      buildDropdownOptions(
        productMasterOptions
          .filter((option) => option.type === "fabric" && option.active)
          .map((option) => option.value),
        form.fabric
      ),
    [form.fabric, productMasterOptions]
  );
  const colorOptions = useMemo(
    () =>
      buildDropdownOptions(
        productMasterOptions
          .filter((option) => option.type === "color" && option.active)
          .map((option) => option.value),
        form.color
      ),
    [form.color, productMasterOptions]
  );
  const collectionLabelOptions = useMemo(
    () =>
      buildDropdownOptions(
        productMasterOptions
          .filter((option) => option.type === "collection_label" && option.active)
          .map((option) => option.value),
        form.collectionLabel
      ),
    [form.collectionLabel, productMasterOptions]
  );

  async function handleSignIn() {
    setAuthError(null);

    try {
      await signInAsOwner();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Google sign-in failed.");
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await signOutOwner();
      resetForm();
      setDialogState(null);
      router.replace("/owner");
    } finally {
      setIsSigningOut(false);
    }
  }

  function beginEditing(product: Saree) {
    setIsProductFormOpen(true);
    setEditingProductId(product.id ?? null);
    setRemovedGalleryPaths([]);
    setPrimaryImageFile(null);
    setGalleryFiles([]);
    setActionError(null);
    setActionNotice(null);
    setForm({
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      category: product.category,
      fabric: product.fabric,
      color: product.color,
      description: product.description,
      price: String(product.price),
      originalPrice:
        typeof product.originalPrice === "number" && Number.isFinite(product.originalPrice)
          ? String(product.originalPrice)
          : "",
      discountPercent:
        typeof product.discountPercent === "number" && Number.isFinite(product.discountPercent)
          ? String(product.discountPercent)
          : "",
      collectionLabel: product.collectionLabel ?? "",
      occasionTags: normalizeOccasionTags(product.occasionTags),
      availableStock: String(normalizeAvailableStock(product.availableStock)),
      status: getEffectiveAvailabilityStatus(product.status, normalizeAvailableStock(product.availableStock)),
      featured: product.featured,
      primaryImageUrl: product.primaryImageUrl,
      primaryImagePath: product.primaryImagePath ?? "",
      galleryImages: product.galleryImageUrls.map((url, index) => ({
        url,
        path: product.galleryImagePaths?.[index] ?? null
      })),
      length: product.length ?? defaultProductLength,
      washCare: product.washCare ?? defaultWashCare,
      productNote: product.productNote ?? defaultProductNote,
      sareeCareTips: (product.sareeCareTips?.length ? product.sareeCareTips : defaultSareeCareTips).join("\n"),
      dryingTips: (product.dryingTips?.length ? product.dryingTips : defaultDryingTips).join("\n")
    });
  }

  function resetForm() {
    setEditingProductId(null);
    setIsProductFormOpen(false);
    setPrimaryImageFile(null);
    setGalleryFiles([]);
    setRemovedGalleryPaths([]);
    setActionError(null);
    setForm(createEmptyForm());
  }

  function startCreatingProduct() {
    setEditingProductId(null);
    setIsProductFormOpen(true);
    setPrimaryImageFile(null);
    setGalleryFiles([]);
    setRemovedGalleryPaths([]);
    setActionError(null);
    setActionNotice(null);
    setForm(createEmptyForm());
  }

  function removeExistingGalleryImage(index: number) {
    const image = form.galleryImages[index];

    setForm((current) => ({
      ...current,
      galleryImages: current.galleryImages.filter((_, itemIndex) => itemIndex !== index)
    }));

    if (image?.path) {
      setRemovedGalleryPaths((current) => [...current, image.path as string]);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!ownerAuthorized) {
      setActionError("You must be signed in as the owner to save products.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionNotice(null);

    try {
      const normalizedSku = form.sku.trim().toUpperCase();
      const normalizedSlug = slugifySareeName(form.slug || form.name);

      if (!form.name.trim() || !normalizedSku || !form.category.trim() || !form.fabric.trim()) {
        throw new Error("Name, SKU, category, and fabric are required.");
      }

      if (!editingProductId && !primaryImageFile && !form.primaryImageUrl.trim()) {
        throw new Error("A primary product image is required.");
      }

      let primaryImageUrl = form.primaryImageUrl.trim();
      let primaryImagePath = form.primaryImagePath.trim();

      if (primaryImageFile) {
        const upload = await uploadSareeImage(primaryImageFile, normalizedSku);

        if (editingProductId && primaryImagePath) {
          await deleteSareeImages([primaryImagePath]);
        }

        primaryImageUrl = upload.url;
        primaryImagePath = upload.path;
      }

      const uploadedGallery = await Promise.all(
        galleryFiles.map((file) => uploadSareeImage(file, normalizedSku))
      );

      if (removedGalleryPaths.length > 0) {
        await deleteSareeImages(removedGalleryPaths);
      }

      const galleryImageUrls = [
        ...form.galleryImages.map((image) => image.url),
        ...uploadedGallery.map((image) => image.url)
      ];
      const galleryImagePaths = [
        ...form.galleryImages.map((image) => image.path ?? ""),
        ...uploadedGallery.map((image) => image.path)
      ].filter(Boolean);

      const price = Number(form.price);
      const originalPrice = form.originalPrice ? Number(form.originalPrice) : null;
      const availableStock = parseAvailableStock(form.availableStock);
      const computedDiscountValue = calculateDiscountPercent(form.price, form.originalPrice);
      const computedDiscount = computedDiscountValue ? Number(computedDiscountValue) : null;

      const normalizedSareeCareTips = form.sareeCareTips
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
      const normalizedDryingTips = form.dryingTips
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
      const occasionTags = normalizeOccasionTags(form.occasionTags);

      const payload: Omit<Saree, "id" | "createdAt" | "updatedAt"> = {
        name: form.name.trim(),
        slug: normalizedSlug,
        sku: normalizedSku,
        category: form.category.trim(),
        fabric: form.fabric.trim(),
        color: form.color.trim(),
        description: form.description.trim(),
        price,
        originalPrice,
        discountPercent: computedDiscount,
        collectionLabel: form.collectionLabel.trim() || null,
        occasionTags,
        availableStock,
        status: resolveStatusForSave(form.status, availableStock),
        featured: form.featured,
        primaryImageUrl,
        primaryImagePath,
        galleryImageUrls,
        galleryImagePaths,
        length: form.length.trim() || defaultProductLength,
        washCare: form.washCare.trim() || defaultWashCare,
        productNote: form.productNote.trim() || defaultProductNote,
        sareeCareTips: normalizedSareeCareTips.length > 0 ? normalizedSareeCareTips : defaultSareeCareTips,
        dryingTips: normalizedDryingTips.length > 0 ? normalizedDryingTips : defaultDryingTips
      };

      if (editingProductId) {
        await updateSaree(editingProductId, payload);
      } else {
        await createSaree(payload);
      }

      const successMessage = editingProductId
        ? `${form.name.trim()} was updated successfully.`
        : `${form.name.trim()} was added to the catalogue.`;
      resetForm();
      setActionNotice(successMessage);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Saving product failed.");
    } finally {
      setIsSaving(false);
    }
  }

  function requestDeleteProduct(product: Saree) {
    if (!product.id) {
      return;
    }

    setDialogState({ type: "delete-product", product });
  }

  async function confirmDeleteProduct(product: Saree) {
    if (!product.id) {
      return;
    }

    setIsDeletingId(product.id);
    setActionError(null);
    setActionNotice(null);

    try {
      const paths = [product.primaryImagePath ?? "", ...(product.galleryImagePaths ?? [])].filter(Boolean);
      if (paths.length > 0) {
        await deleteSareeImages(paths);
      }

      await deleteSaree(product.id);

      if (editingProductId === product.id) {
        resetForm();
      }
      setDialogState(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Deleting product failed.");
    } finally {
      setIsDeletingId(null);
    }
  }

  async function handleSeedDummyCatalogue() {
    if (!ownerAuthorized) {
      setActionError("You must be signed in as the owner to generate dummy products.");
      return;
    }

    setIsSeedingDummy(true);
    setActionError(null);
    setActionNotice(null);

    try {
      const result = await seedDummyCatalogue({
        existingProducts: products,
        productGroups,
        productMasterOptions
      });

      setActionNotice(
        result.created > 0
          ? `Created ${result.created} dummy products across ${result.categories.length} categor${result.categories.length === 1 ? "y" : "ies"}. Skipped ${result.skipped} existing SKU${result.skipped === 1 ? "" : "s"}.`
          : `No new dummy products were created. Skipped ${result.skipped} existing SKU${result.skipped === 1 ? "" : "s"}.`
      );
      setDialogState(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Dummy catalogue generation failed.");
    } finally {
      setIsSeedingDummy(false);
    }
  }

  async function handleDialogConfirm() {
    if (!dialogState) {
      return;
    }

    if (dialogState.type === "signout") {
      await handleSignOut();
      return;
    }

    if (dialogState.type === "delete-product") {
      await confirmDeleteProduct(dialogState.product);
      return;
    }

    if (dialogState.type === "seed-dummy") {
      await handleSeedDummyCatalogue();
    }
  }

  const dialogPending =
    (dialogState?.type === "signout" && isSigningOut) ||
    (dialogState?.type === "delete-product" &&
      Boolean(dialogState.product.id && isDeletingId === dialogState.product.id)) ||
    (dialogState?.type === "seed-dummy" && isSeedingDummy);

  const dialogTitle =
    dialogState?.type === "signout"
      ? "Sign out of the owner panel?"
      : dialogState?.type === "delete-product"
        ? "Delete this product?"
        : dialogState?.type === "seed-dummy"
          ? "Generate dummy catalogue data?"
        : "";

  const dialogMessage =
    dialogState?.type === "signout"
      ? "You will be signed out of the owner dashboard on this device."
      : dialogState?.type === "delete-product"
        ? `${dialogState.product.name} will be deleted from the catalogue and its uploaded images will also be removed.`
        : dialogState?.type === "seed-dummy"
          ? "This will create up to 100 dummy products per available category using reusable local images and mixed product states for testing. Existing dummy SKUs will be skipped."
          : "";

  const dialogConfirmLabel =
    dialogState?.type === "signout"
      ? "SIGN OUT"
      : dialogState?.type === "delete-product"
        ? "DELETE PRODUCT"
        : dialogState?.type === "seed-dummy"
          ? "GENERATE DUMMY DATA"
          : "CONFIRM";

  const dialogTone = dialogState?.type === "delete-product" ? "danger" : "neutral";

  const stats = {
    total: products.length,
    active: products.filter((product) => product.status === "active").length,
    featured: products.filter((product) => product.featured).length,
    outOfStock: products.filter((product) => product.status === "out_of_stock").length
  };

  const productsByCategory = useMemo(() => {
    const grouped = new Map<string, Saree[]>();

    products.forEach((product) => {
      const key = product.category.trim() || "Uncategorized";
      const current = grouped.get(key) ?? [];
      current.push(product);
      grouped.set(key, current);
    });

    return Array.from(grouped.entries()).map(([category, items]) => ({
      category,
      items
    }));
  }, [products]);

  const isCreatingProduct = isProductFormOpen && !editingProductId;
  const isEditingProduct = Boolean(editingProductId);

  function renderProductForm({
    mode,
    shellClassName,
    showHeaderClose = false
  }: {
    mode: "create" | "edit";
    shellClassName: string;
    showHeaderClose?: boolean;
  }) {
    return (
      <div className={shellClassName}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="brand-copy text-2xl text-[#3f4738]">{mode === "edit" ? "Edit item" : "Add new item"}</h3>
            <p className="mt-1 text-sm text-[#667056]">
              {mode === "edit"
                ? "Update this product here without leaving the catalogue cards below."
                : "Product records are stored in Firestore and product images in Firebase Storage."}
            </p>
          </div>

          {showHeaderClose ? (
            <button
              type="button"
              onClick={resetForm}
              className="brand-caption rounded-2xl border border-[#d1c3ae] px-5 py-3 text-[0.58rem] font-semibold tracking-[0.08em] text-[#5e684f]"
            >
              CLOSE
            </button>
          ) : null}
        </div>

        {mode === "edit" && actionError ? <p className="mt-5 text-sm text-[#9d4b45]">{actionError}</p> : null}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product name">
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                    slug: current.slug || slugifySareeName(event.target.value)
                  }))
                }
                className={inputClassName}
                placeholder="Medha"
                required
              />
            </Field>
            <Field label="Slug">
              <input
                value={form.slug}
                onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                className={inputClassName}
                placeholder="medha"
                required
              />
            </Field>
            <Field label="SKU">
              <input
                value={form.sku}
                onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value.toUpperCase() }))}
                className={inputClassName}
                placeholder="LSM137"
                required
              />
            </Field>
            <Field label="Product group / Category">
              <div>
                <select
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  className={inputClassName}
                  required
                >
                  <option value="">
                    {categoryOptions.length === 0 ? "Add categories in Product groups first" : "Select category"}
                  </option>
                  {categoryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs leading-6 text-[#667056]">
                  Pick from Product groups above so product categories and shop filters stay aligned.
                </p>
              </div>
            </Field>
            <Field label="Fabric">
              <select
                value={form.fabric}
                onChange={(event) => setForm((current) => ({ ...current, fabric: event.target.value }))}
                className={inputClassName}
                required
              >
                <option value="">
                  {fabricOptions.length === 0 ? "Add fabrics in Product master data first" : "Select fabric"}
                </option>
                {fabricOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Color">
              <select
                value={form.color}
                onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
                className={inputClassName}
              >
                <option value="">Select color (optional)</option>
                {colorOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Price (INR)">
              <input
                value={form.price}
                onChange={(event) =>
                  setForm((current) => {
                    const price = event.target.value;
                    return {
                      ...current,
                      price,
                      discountPercent: calculateDiscountPercent(price, current.originalPrice)
                    };
                  })
                }
                className={inputClassName}
                inputMode="decimal"
                placeholder="1650"
                required
              />
            </Field>
            <Field label="Original price (optional)">
              <input
                value={form.originalPrice}
                onChange={(event) =>
                  setForm((current) => {
                    const originalPrice = event.target.value;
                    return {
                      ...current,
                      originalPrice,
                      discountPercent: calculateDiscountPercent(current.price, originalPrice)
                    };
                  })
                }
                className={inputClassName}
                inputMode="decimal"
                placeholder="1900"
              />
            </Field>
            <Field label="Discount % (optional)">
              <div>
                <input
                  value={form.discountPercent}
                  readOnly
                  className={`${inputClassName} bg-[#f5efe4] text-[#667056]`}
                  inputMode="numeric"
                  placeholder="Auto calculated"
                />
                <p className="mt-2 text-xs leading-6 text-[#667056]">
                  {autoDiscountPreview
                    ? `Auto calculated: ${autoDiscountPreview}%`
                    : "Shown only when Original price is higher than Price."}
                </p>
              </div>
            </Field>
            <Field label="Collection label">
              <select
                value={form.collectionLabel}
                onChange={(event) => setForm((current) => ({ ...current, collectionLabel: event.target.value }))}
                className={inputClassName}
              >
                <option value="">Select collection label (optional)</option>
                {collectionLabelOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Occasion / Use case">
              <div className="rounded-[1.25rem] border border-[#d9ccb8] bg-white/80 px-4 py-4">
                <div className="flex flex-wrap gap-2">
                  {MANUAL_OCCASION_TAGS.map((tag) => {
                    const selected = form.occasionTags.includes(tag);

                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            occasionTags: selected
                              ? current.occasionTags.filter((item) => item !== tag)
                              : [...current.occasionTags, tag]
                          }))
                        }
                        className={`rounded-full border px-3 py-2 text-sm transition ${
                          selected
                            ? "border-[#5e684f] bg-[#5e684f] text-[#fbf4e8]"
                            : "border-[#d9ccb8] bg-[#f8f1e5] text-[#5f6852]"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs leading-6 text-[#667056]">
                  Used for storefront browsing like wedding, gifting, and everyday.
                </p>
              </div>
            </Field>
            <Field label="Available stock">
              <input
                value={form.availableStock}
                onChange={(event) => setForm((current) => ({ ...current, availableStock: event.target.value }))}
                className={inputClassName}
                inputMode="numeric"
                placeholder={String(DEFAULT_AVAILABLE_STOCK)}
                required
              />
            </Field>
            <Field label="Status">
              <select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as SareeStatus }))}
                className={inputClassName}
              >
                <option value="active">Active</option>
                <option value="out_of_stock">Out of stock</option>
                <option value="draft">Draft</option>
              </select>
            </Field>
            <Field label="Featured">
              <label className="flex h-[52px] items-center gap-3 rounded-[1rem] border border-[#d9ccb8] bg-white/70 px-4 text-sm text-[#3f4738]">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(event) => setForm((current) => ({ ...current, featured: event.target.checked }))}
                  className="h-4 w-4 accent-[#5e684f]"
                />
                Show in featured section
              </label>
            </Field>
          </div>

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className={`${inputClassName} min-h-[120px] py-4`}
              placeholder="Write a product story, weave details, and occasion notes."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Length">
              <input
                value={form.length}
                onChange={(event) => setForm((current) => ({ ...current, length: event.target.value }))}
                className={inputClassName}
                placeholder="6.5 meters with blouse piece"
              />
            </Field>
            <Field label="Wash care">
              <input
                value={form.washCare}
                onChange={(event) => setForm((current) => ({ ...current, washCare: event.target.value }))}
                className={inputClassName}
                placeholder="Dry clean recommended"
              />
            </Field>
          </div>

          <Field label="Product note">
            <textarea
              value={form.productNote}
              onChange={(event) => setForm((current) => ({ ...current, productNote: event.target.value }))}
              className={`${inputClassName} min-h-[90px] py-4`}
              placeholder="Due to variations in lighting and screen settings, actual product color may differ slightly from the images."
            />
          </Field>

          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Care and handling">
              <textarea
                value={form.sareeCareTips}
                onChange={(event) => setForm((current) => ({ ...current, sareeCareTips: event.target.value }))}
                className={`${inputClassName} min-h-[150px] py-4`}
                placeholder={"Dry wash recommended\nHand wash in cold water if needed\nUse a mild detergent"}
              />
            </Field>
            <Field label="Drying and finishing">
              <textarea
                value={form.dryingTips}
                onChange={(event) => setForm((current) => ({ ...current, dryingTips: event.target.value }))}
                className={`${inputClassName} min-h-[150px] py-4`}
                placeholder={"Air dry in shade\nAvoid direct sunlight\nFold only after fully dry"}
              />
            </Field>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Primary image">
              <div className="rounded-[1rem] border border-dashed border-[#d8cbb7] bg-white/70 p-4">
                {form.primaryImageUrl ? (
                  <div
                    className="mb-4 aspect-[0.88] w-full rounded-[1rem] bg-cover bg-center"
                    style={{ backgroundImage: `url('${form.primaryImageUrl}')` }}
                  />
                ) : null}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setPrimaryImageFile(event.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-[#667056] file:mr-4 file:rounded-full file:border-0 file:bg-[#5e684f] file:px-4 file:py-2 file:text-xs file:font-semibold file:tracking-[0.08em] file:text-[#fbf4e8]"
                />
              </div>
            </Field>

            <Field label="Gallery images">
              <div className="rounded-[1rem] border border-dashed border-[#d8cbb7] bg-white/70 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {form.galleryImages.map((image, index) => (
                    <div key={`${image.url}-${index}`} className="rounded-[1rem] bg-[#fbf4e8] p-3">
                      <div
                        className="aspect-[0.92] w-full rounded-[0.9rem] bg-cover bg-center"
                        style={{ backgroundImage: `url('${image.url}')` }}
                      />
                      <button
                        type="button"
                        onClick={() => removeExistingGalleryImage(index)}
                        className="brand-caption mt-3 rounded-full border border-[#d5c7b4] px-3 py-1.5 text-[0.52rem] font-semibold tracking-[0.08em] text-[#7d5147]"
                      >
                        REMOVE
                      </button>
                    </div>
                  ))}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => setGalleryFiles(Array.from(event.target.files ?? []))}
                  className="mt-4 block w-full text-sm text-[#667056] file:mr-4 file:rounded-full file:border-0 file:bg-[#5e684f] file:px-4 file:py-2 file:text-xs file:font-semibold file:tracking-[0.08em] file:text-[#fbf4e8]"
                />
                {galleryFiles.length > 0 ? (
                  <p className="mt-3 text-xs text-[#667056]">{galleryFiles.length} new gallery image(s) queued.</p>
                ) : null}
              </div>
            </Field>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="brand-caption rounded-2xl bg-[#5e684f] px-6 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#fbf4e8] disabled:opacity-60"
            >
              {isSaving ? "SAVING..." : mode === "edit" ? "UPDATE PRODUCT" : "CREATE PRODUCT"}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="brand-caption rounded-2xl border border-[#d1c3ae] px-6 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#5e684f]"
            >
              {mode === "edit" ? "CLOSE EDITOR" : "CLOSE FORM"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (!firebaseReady) {
    return (
      <main className="min-h-screen bg-[#fbf4e8] px-6 py-20 text-[#4f5942] sm:px-10 lg:px-12">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-8">
          <h1 className="brand-copy text-3xl text-[#3f4738]">Firebase configuration missing</h1>
          <p className="mt-4 text-sm leading-7 text-[#667056]">
            Add your `NEXT_PUBLIC_FIREBASE_*` variables before using the owner backoffice.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbf4e8] px-6 py-12 text-[#4f5942] sm:px-10 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <OwnerSectionHero
          eyebrow="OWNER CATALOGUE"
          title="Catalogue workspace for products, pricing, and stock"
          description="Use this page for catalogue operations only. Storefront structure, orders, messages, waitlist, and owner access now live in their own pages."
          action={
            user ? (
              <button
                type="button"
                onClick={() => setDialogState({ type: "signout" })}
                className="brand-caption rounded-2xl bg-[#f8ecd2] px-5 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#5a6851]"
              >
                SIGN OUT
              </button>
            ) : null
          }
        />

        <OwnerBackofficeNav
          className="mt-6"
          badges={{
            "/owner/messages": customerMessagesLoading ? "..." : customerMessageCount,
            "/owner/orders": "Paid",
            "/owner/waitlist": waitlistLoading ? "..." : waitlistCount
          }}
        />

        {authLoading || (user && !isPrimaryOwnerEmail(user?.email) && ownerAccountsLoading) ? (
          <div className="mt-10 rounded-[1.8rem] border border-[#e3d8c9] bg-[#f8f0e3] p-8 text-sm text-[#667056]">
            Checking Google session…
          </div>
        ) : !ownerAuthorized ? (
          <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-[1.8rem] border border-[#e3d8c9] bg-[#f8f0e3] p-8">
              <h2 className="brand-copy text-3xl text-[#3f4738]">Sign in to owner mode</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#667056]">
                Use Google login with an authorized account. Only approved owners can access catalogue writes.
              </p>
              {user ? (
                <button
                  type="button"
                  onClick={() => setDialogState({ type: "signout" })}
                  className="brand-caption mt-8 inline-flex rounded-2xl border border-[#cfc2ad] px-6 py-3 text-[0.66rem] font-semibold tracking-[0.08em] text-[#5e684f]"
                >
                  SIGN OUT
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSignIn}
                  className="brand-caption mt-8 inline-flex rounded-2xl bg-[#5e684f] px-6 py-3 text-[0.66rem] font-semibold tracking-[0.08em] text-[#fbf4e8]"
                >
                  SIGN IN WITH GOOGLE
                </button>
              )}
              {authError ? <p className="mt-4 text-sm text-[#9d4b45]">{authError}</p> : null}
              {ownerAccessError ? <p className="mt-4 text-sm text-[#9d4b45]">{ownerAccessError}</p> : null}
              {user && !ownerAuthorized ? (
                <p className="mt-4 text-sm text-[#9d4b45]">
                  {user.email} is signed in, but does not have owner access.
                </p>
              ) : null}
            </section>

            <aside className="rounded-[1.8rem] border border-[#e3d8c9] bg-white/70 p-8">
              <h3 className="brand-copy text-2xl text-[#3f4738]">Firebase notes</h3>
              <ul className="mt-5 space-y-3 text-sm leading-7 text-[#667056]">
                <li>Enable Google Authentication in Firebase Console.</li>
                <li>Set `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` to your live custom domain.</li>
                <li>Add `eshwe.com` to Firebase Authentication authorized domains.</li>
                <li>Add `https://eshwe.com/__/auth/handler` to the Google OAuth redirect URIs.</li>
                <li>Deploy Firestore and Storage rules after this code update.</li>
              </ul>
            </aside>
          </div>
        ) : (
          <div className="mt-10 space-y-8">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <StatCard label="Total Products" value={String(stats.total)} />
              <StatCard label="Active" value={String(stats.active)} />
              <StatCard label="Featured" value={String(stats.featured)} />
              <StatCard label="Out Of Stock" value={String(stats.outOfStock)} />
              <Link
                href="/owner/messages/"
                className="rounded-[1.5rem] border border-[#d8cbb7] bg-white/80 p-6 shadow-[0_16px_35px_rgba(94,104,79,0.06)] transition-colors duration-200 hover:border-[#bdae97] hover:bg-[#fdf8f0]"
              >
                <p className="text-sm text-[#667056]">Messages</p>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <p className="brand-copy text-4xl text-[#3f4738]">
                    {customerMessagesLoading ? "..." : String(customerMessageCount)}
                  </p>
                  <span className="brand-caption text-[0.62rem] font-semibold tracking-[0.08em] text-[#5e684f]">
                    OPEN
                  </span>
                </div>
              </Link>
              <Link
                href="/owner/waitlist/"
                className="rounded-[1.5rem] border border-[#d8cbb7] bg-white/80 p-6 shadow-[0_16px_35px_rgba(94,104,79,0.06)] transition-colors duration-200 hover:border-[#bdae97] hover:bg-[#fdf8f0]"
              >
                <p className="text-sm text-[#667056]">Waitlist</p>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <p className="brand-copy text-4xl text-[#3f4738]">
                    {waitlistLoading ? "..." : String(waitlistCount)}
                  </p>
                  <span className="brand-caption text-[0.62rem] font-semibold tracking-[0.08em] text-[#5e684f]">
                    OPEN
                  </span>
                </div>
              </Link>
              <Link
                href="/owner/orders/"
                className="rounded-[1.5rem] border border-[#d8cbb7] bg-white/80 p-6 shadow-[0_16px_35px_rgba(94,104,79,0.06)] transition-colors duration-200 hover:border-[#bdae97] hover:bg-[#fdf8f0]"
              >
                <p className="text-sm text-[#667056]">Orders</p>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <p className="brand-copy text-4xl text-[#3f4738]">Paid</p>
                  <span className="brand-caption text-[0.62rem] font-semibold tracking-[0.08em] text-[#5e684f]">
                    OPEN
                  </span>
                </div>
              </Link>
            </section>

            <section className="space-y-8">
              <section className="rounded-[1.8rem] border border-[#e3d8c9] bg-[#f8f0e3] p-7 sm:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="brand-copy text-3xl text-[#3f4738]">Product workspace</h2>
                    <p className="mt-2 text-sm leading-7 text-[#667056]">
                      Keep catalogue edits intentional. Open the form only when you are adding a new saree or updating one.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={startCreatingProduct}
                      className="brand-caption rounded-2xl bg-[#5e684f] px-5 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#fbf4e8]"
                    >
                      ADD NEW ITEM
                    </button>
                    <button
                      type="button"
                      onClick={() => setDialogState({ type: "seed-dummy" })}
                      disabled={isSeedingDummy}
                      className="brand-caption rounded-2xl border border-[#cfc2ad] bg-white/70 px-5 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#5e684f] disabled:opacity-60"
                    >
                      {isSeedingDummy ? "GENERATING..." : "GENERATE DUMMY DATA"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDialogState({ type: "signout" })}
                      className="brand-caption rounded-2xl border border-[#cfc2ad] px-4 py-3 text-[0.58rem] font-semibold tracking-[0.08em] text-[#5e684f]"
                    >
                      SIGN OUT
                    </button>
                  </div>
                </div>

                {actionError ? <p className="mt-5 text-sm text-[#9d4b45]">{actionError}</p> : null}
                {actionNotice ? <p className="mt-5 text-sm text-[#4d6a41]">{actionNotice}</p> : null}

                {!isCreatingProduct ? (
                  <div className="mt-8 rounded-[1.5rem] border border-dashed border-[#d8cbb7] bg-white/65 p-6 sm:p-7">
                    <p className="brand-caption text-[0.58rem] font-semibold tracking-[0.18em] text-[#7d876f]">
                      CLEAN WORKFLOW
                    </p>
                    <h3 className="brand-copy mt-3 text-2xl text-[#3f4738]">Open the form only when needed</h3>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-[#667056]">
                      Use the grouped catalogue cards below to browse each category, then edit any item directly. When you want a new record, open a fresh product form from here.
                    </p>
                    <button
                      type="button"
                      onClick={startCreatingProduct}
                      className="brand-caption mt-6 rounded-2xl bg-[#5e684f] px-6 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#fbf4e8]"
                    >
                      CREATE PRODUCT
                    </button>
                  </div>
                ) : (
                  renderProductForm({
                    mode: "create",
                    shellClassName: "mt-8 rounded-[1.5rem] border border-[#e1d5c5] bg-white/65 p-6 sm:p-7"
                  })
                )}
              </section>

              <section className="rounded-[1.8rem] border border-[#e3d8c9] bg-white/70 p-7 sm:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="brand-copy text-3xl text-[#3f4738]">Catalogue records</h2>
                    <p className="mt-2 text-sm text-[#667056]">
                      {products.length} product records grouped by category to keep the backoffice clean.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={startCreatingProduct}
                    className="brand-caption rounded-2xl bg-[#5e684f] px-5 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#fbf4e8]"
                  >
                    ADD NEW ITEM
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialogState({ type: "seed-dummy" })}
                    disabled={isSeedingDummy}
                    className="brand-caption rounded-2xl border border-[#cfc2ad] bg-white/75 px-5 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#5e684f] disabled:opacity-60"
                  >
                    {isSeedingDummy ? "GENERATING..." : "GENERATE DUMMY DATA"}
                  </button>
                </div>

                <div className="mt-6 space-y-6">
                  {readError ? <p className="text-sm text-[#9d4b45]">Firebase read failed: {readError}</p> : null}
                  {productsLoading ? (
                    <p className="text-sm text-[#667056]">Loading products…</p>
                  ) : products.length === 0 ? (
                    <div className="rounded-[1.3rem] border border-dashed border-[#d8cbb7] bg-[#fbf4e8] p-5 text-sm leading-7 text-[#667056]">
                      No products yet. Add the first saree from the workspace to turn the storefront live.
                    </div>
                  ) : (
                    productsByCategory.map(({ category, items }) => (
                      <section
                        key={category}
                        className="rounded-[1.55rem] border border-[#e5d8c8] bg-[#fbf4e8] p-5 shadow-[0_12px_30px_rgba(94,104,79,0.04)] sm:p-6"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="brand-caption text-[0.58rem] font-semibold tracking-[0.18em] text-[#7d876f]">
                              CATEGORY
                            </p>
                            <h3 className="brand-copy mt-2 text-2xl text-[#3f4738]">{category}</h3>
                          </div>
                          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-[#667056]">
                            {items.length} item{items.length === 1 ? "" : "s"}
                          </span>
                        </div>

                        <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                          {items.map((product) => (
                            <article
                              key={product.id}
                              className="rounded-[1.35rem] border border-[#e8dccd] bg-white/72 p-4 shadow-[0_10px_25px_rgba(94,104,79,0.05)]"
                            >
                              <div className="flex gap-4">
                                <div
                                  className="h-24 w-20 shrink-0 rounded-[1rem] bg-cover bg-center"
                                  style={{ backgroundImage: `url('${product.primaryImageUrl}')` }}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="brand-copy text-xl text-[#3f4738]">{product.name}</h4>
                                    <StatusBadge status={product.status} />
                                    {product.featured ? (
                                      <span className="rounded-full bg-[#efe4c6] px-2.5 py-1 text-[0.68rem] font-semibold text-[#5e684f]">
                                        Featured
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 text-sm text-[#667056]">
                                    {product.sku} · {product.fabric}
                                  </p>
                                  {product.occasionTags?.length ? (
                                    <p className="mt-1 text-sm text-[#667056]">{formatOccasionSummary(product.occasionTags)}</p>
                                  ) : null}
                                  <p className="mt-1 text-sm text-[#667056]">
                                    Stock {normalizeAvailableStock(product.availableStock)}
                                  </p>
                                  <p className="mt-2 text-base font-semibold text-[#1f1a17]">
                                    {formatCurrency(product.price)}
                                    {typeof product.originalPrice === "number" ? (
                                      <span className="ml-3 text-sm font-normal text-[#8a8d87] line-through">
                                        {formatCurrency(product.originalPrice)}
                                      </span>
                                    ) : null}
                                  </p>
                                  <div className="mt-4 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => beginEditing(product)}
                                      className="brand-caption rounded-full bg-[#5e684f] px-4 py-2 text-[0.52rem] font-semibold tracking-[0.08em] text-[#fbf4e8]"
                                    >
                                      EDIT
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => requestDeleteProduct(product)}
                                      disabled={isDeletingId === product.id}
                                      className="brand-caption rounded-full border border-[#d4c5b2] px-4 py-2 text-[0.52rem] font-semibold tracking-[0.08em] text-[#9d4b45] disabled:opacity-60"
                                    >
                                      {isDeletingId === product.id ? "DELETING..." : "DELETE"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      </section>
                    ))
                  )}
                </div>
              </section>

              {isEditingProduct ? (
                <div className="fixed inset-0 z-50 bg-[#3f4738]/32 px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
                  <div className="mx-auto h-full max-w-6xl overflow-hidden rounded-[2rem] border border-[#dfd2c1] bg-[#fbf4e8] shadow-[0_30px_90px_rgba(63,71,56,0.22)]">
                    <div className="h-full overflow-y-auto p-5 sm:p-7 lg:p-8">
                      {renderProductForm({
                        mode: "edit",
                        shellClassName: "rounded-[1.5rem] border border-[#e1d5c5] bg-white/70 p-6 sm:p-7",
                        showHeaderClose: true
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </section>

            <ConfirmationDialog
              open={Boolean(dialogState)}
              title={dialogTitle}
              message={dialogMessage}
              confirmLabel={dialogConfirmLabel}
              tone={dialogTone}
              pending={Boolean(dialogPending)}
              onConfirm={handleDialogConfirm}
              onClose={() => setDialogState(null)}
            />
          </div>
        )}
      </div>
    </main>
  );
}

function createEmptyForm(): ProductFormState {
  return {
    name: "",
    slug: "",
    sku: "",
    category: "",
    fabric: "",
    color: "",
    description: "",
    price: "",
    originalPrice: "",
    discountPercent: "",
    collectionLabel: "",
    occasionTags: [],
    availableStock: String(DEFAULT_AVAILABLE_STOCK),
    status: "active",
    featured: false,
    primaryImageUrl: "",
    primaryImagePath: "",
    galleryImages: [],
    length: defaultProductLength,
    washCare: defaultWashCare,
    productNote: defaultProductNote,
    sareeCareTips: defaultSareeCareTips.join("\n"),
    dryingTips: defaultDryingTips.join("\n")
  };
}

function parseAvailableStock(value: string) {
  const availableStock = Number(value);

  if (!Number.isInteger(availableStock) || availableStock < 0) {
    throw new Error("Available stock must be a whole number of 0 or more.");
  }

  return availableStock;
}

function resolveStatusForSave(status: SareeStatus, availableStock: number): SareeStatus {
  return getEffectiveAvailabilityStatus(status, availableStock);
}

function calculateDiscountPercent(priceValue: string, originalPriceValue: string) {
  const price = Number(priceValue);
  const originalPrice = Number(originalPriceValue);

  if (!Number.isFinite(price) || !Number.isFinite(originalPrice) || price <= 0 || originalPrice <= price) {
    return "";
  }

  return String(Math.round(((originalPrice - price) / originalPrice) * 100));
}

function buildDropdownOptions(values: string[], currentValue?: string) {
  return Array.from(new Set([...values, currentValue ?? ""])).filter(Boolean).sort((left, right) => left.localeCompare(right));
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#4f5942]">{label}</span>
      {children}
    </label>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[1.5rem] border border-[#e3d8c9] bg-[#f8f0e3] p-6 shadow-[0_16px_35px_rgba(94,104,79,0.06)]">
      <p className="text-sm text-[#667056]">{label}</p>
      <p className="brand-copy mt-3 text-4xl text-[#3f4738]">{value}</p>
    </article>
  );
}

function StatusBadge({ status }: { status: SareeStatus }) {
  const badgeLabel =
    status === "active" ? "Active" : status === "out_of_stock" ? "Out of stock" : "Draft";
  const badgeClassName =
    status === "active"
      ? "bg-[#dfe9d6] text-[#4d6a41]"
      : status === "out_of_stock"
        ? "bg-[#f3ddd6] text-[#8a4d43]"
        : "bg-[#ece7dd] text-[#6b665f]";

  return <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${badgeClassName}`}>{badgeLabel}</span>;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(value);
}

const inputClassName =
  "h-[52px] w-full rounded-[1rem] border border-[#d9ccb8] bg-white/70 px-4 text-sm text-[#3f4738] outline-none transition-colors duration-200 placeholder:text-[#948978] focus:border-[#5e684f]";
