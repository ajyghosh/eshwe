export type CheckoutOrderCustomer = {
  address: string;
  city: string;
  email: string;
  fullName: string;
  phone: string;
  pincode: string;
  state: string;
};

export type CheckoutOrderAmountBreakdown = {
  packagingFee?: number;
  savings?: number;
  shippingFee?: number;
  subtotal?: number;
  total?: number;
};

export type CheckoutOrderItem = {
  color?: string;
  name: string;
  primaryImageUrl?: string;
  productId?: string;
  quantity: number;
  sku: string;
  slug?: string;
  status?: string;
  unitOriginalPrice?: number | null;
  unitPrice?: number | null;
};

export type CheckoutOrder = {
  id: string;
  amountBreakdown?: CheckoutOrderAmountBreakdown;
  amountPaise?: number;
  cartItems?: CheckoutOrderItem[];
  completedAt?: unknown;
  createdAt?: unknown;
  currency?: string;
  customer?: CheckoutOrderCustomer;
  dispatchStatus?: string | null;
  notes?: string;
  paymentCaptured?: boolean;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  receipt?: string | null;
  sourcePath?: string | null;
  status?: string | null;
  updatedAt?: unknown;
  userId?: string | null;
  verifiedAt?: unknown;
};
