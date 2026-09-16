import type { Saree } from "@/types/saree";

export const AFFORDABLE_PRICE_RANGE = "affordable";
export const PRICE_RANGES = [
  { value: AFFORDABLE_PRICE_RANGE, label: "Affordable Elegance · ₹399–₹999", min: 399, max: 999 },
  { value: "under-2000", label: "Up to ₹2,000", min: 0, max: 2000 }
] as const;

export function normalizePriceRange(value?: string | null) {
  return PRICE_RANGES.find((range) => range.value === value)?.value ?? "";
}

export function priceRangeLabel(value: string) {
  return PRICE_RANGES.find((range) => range.value === value)?.label ?? "All prices";
}

export function matchesPriceRange(product: Pick<Saree, "price">, value: string) {
  const range = PRICE_RANGES.find((option) => option.value === value);
  return !range || (Number.isFinite(product.price) && product.price >= range.min && product.price <= range.max);
}
