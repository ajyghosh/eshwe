"use client";

import type { ReactNode } from "react";

import { AuthProvider } from "@/components/auth-provider";
import { CartProvider } from "@/components/cart-provider";
import { FavoritesProvider } from "@/components/favorites-provider";
import { FloatingBagButton } from "@/components/floating-bag-button";
import { CheckoutRecoveryBanner } from "@/components/checkout-recovery-banner";
import { CheckoutRecoveryProvider } from "@/components/checkout-recovery-provider";

export function StorefrontShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <FavoritesProvider>
        <CartProvider>
          <CheckoutRecoveryProvider>
            <CheckoutRecoveryBanner />
            {children}
            <FloatingBagButton />
          </CheckoutRecoveryProvider>
        </CartProvider>
      </FavoritesProvider>
    </AuthProvider>
  );
}
