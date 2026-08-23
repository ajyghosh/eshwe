"use client";

import type { ReactNode } from "react";

import { AuthProvider } from "@/components/auth-provider";
import { CartProvider } from "@/components/cart-provider";
import { FloatingBagButton } from "@/components/floating-bag-button";

export function StorefrontShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>
        {children}
        <FloatingBagButton />
      </CartProvider>
    </AuthProvider>
  );
}
