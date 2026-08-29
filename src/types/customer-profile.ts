export type CustomerAddress = {
  id: string;
  label: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
};

export type CustomerProfile = {
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  selectedAddressId?: string;
  addresses?: CustomerAddress[];
  favoriteSkus?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
};
