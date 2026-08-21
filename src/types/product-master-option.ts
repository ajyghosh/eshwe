export type ProductMasterField = "fabric" | "color" | "collection_label";

export type ProductMasterOption = {
  id?: string;
  type: ProductMasterField;
  value: string;
  active: boolean;
  sortOrder: number;
  createdAt?: unknown;
  updatedAt?: unknown;
};
