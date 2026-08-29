export type CustomerMessage = {
  id?: string;
  email: string;
  phone: string;
  message: string;
  sourcePath: string;
  status?: "new" | "read" | null;
  createdAt?: unknown;
  readAt?: unknown;
  updatedAt?: unknown;
};
