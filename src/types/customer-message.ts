export type CustomerMessage = {
  id?: string;
  email: string;
  phone: string;
  message: string;
  sourcePath: string;
  status: "new";
  createdAt?: unknown;
  updatedAt?: unknown;
};
