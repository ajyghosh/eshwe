export type CartItem = {
  sku: string;
  slug: string;
  name: string;
  price: number;
  originalPrice?: number | null;
  primaryImageUrl: string;
  fabric: string;
  color: string;
  status: "active" | "out_of_stock" | "draft";
  quantity: number;
};
