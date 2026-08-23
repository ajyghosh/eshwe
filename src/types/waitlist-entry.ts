export type WaitlistEntryStatus = "new";

export type WaitlistEntry = {
  id?: string;
  productId: string;
  productName: string;
  productSlug: string;
  productSku: string;
  productCategory: string;
  email: string;
  phone: string;
  sourcePath: string;
  status: WaitlistEntryStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
};
