"use client";

import type { ReactNode } from "react";

import { AuthProvider } from "@/components/auth-provider";
import { CartProvider } from "@/components/cart-provider";

export function StorefrontShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>{children}</CartProvider>
    </AuthProvider>
  );
}
