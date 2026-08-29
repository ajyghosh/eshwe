"use client";

import { useState } from "react";

import { OwnerBackofficeNav } from "@/components/owner-backoffice-nav";
import { OwnerCategoryManager } from "@/components/owner-category-manager";
import { OwnerHomepageManager } from "@/components/owner-homepage-manager";
import { OwnerProductGroupManager } from "@/components/owner-product-group-manager";
import { OwnerProductMasterManager } from "@/components/owner-product-master-manager";
import { OwnerSectionHero } from "@/components/owner-section-hero";
import { firebaseReady } from "@/lib/firebase";
import { useOwnerAccess } from "@/lib/use-owner-access";

export function OwnerStorefrontPage() {
  const { authLoading, ownerAccessError, ownerAccountsLoading, ownerAuthorized, signIn, signOut, user } = useOwnerAccess();
  const [authError, setAuthError] = useState<string | null>(null);

  async function handleSignIn() {
    setAuthError(null);

    try {
      await signIn();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Google sign-in failed.");
    }
  }

  async function handleSignOut() {
    await signOut();
  }

  if (!firebaseReady) {
    return (
      <main className="min-h-screen bg-[#fbf4e8] px-6 py-20 text-[#4f5942] sm:px-10 lg:px-12">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-8">
          <h1 className="brand-copy text-3xl text-[#3f4738]">Firebase configuration missing</h1>
          <p className="mt-4 text-sm leading-7 text-[#667056]">
            Add your `NEXT_PUBLIC_FIREBASE_*` variables before using the owner backoffice.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5efe4] px-6 py-10 text-[#4f5942] sm:px-10 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <OwnerSectionHero
          eyebrow="OWNER STOREFRONT"
          title="Homepage, categories, and catalogue master data in one operational lane."
          description="Keep storefront structure separate from order operations. Use this page for content, category systems, and product setup data."
          action={
            user ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="brand-caption rounded-2xl bg-[#f8ecd2] px-5 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#5a6851]"
              >
                SIGN OUT
              </button>
            ) : null
          }
        />

        {ownerAuthorized ? <OwnerBackofficeNav className="mt-6" /> : null}

        {authLoading || (user && ownerAccountsLoading && !ownerAuthorized) ? (
          <div className="mt-8 rounded-[1.8rem] border border-[#e3d8c9] bg-[#fffaf2] p-8 text-sm text-[#667056]">
            Checking Google session…
          </div>
        ) : !ownerAuthorized ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-[1.8rem] border border-[#e3d8c9] bg-[#fffaf2] p-8">
              <h2 className="brand-copy text-3xl text-[#3f4738]">Sign in to manage the storefront</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#667056]">
                Use Google login with an authorized owner account to edit homepage content,
                category systems, and product master data.
              </p>
              {user ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="brand-caption mt-8 inline-flex rounded-2xl border border-[#cfc2ad] px-6 py-3 text-[0.66rem] font-semibold tracking-[0.08em] text-[#5e684f]"
                >
                  SIGN OUT
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSignIn}
                  className="brand-caption mt-8 inline-flex rounded-2xl bg-[#5e684f] px-6 py-3 text-[0.66rem] font-semibold tracking-[0.08em] text-[#fbf4e8]"
                >
                  SIGN IN WITH GOOGLE
                </button>
              )}
              {authError ? <p className="mt-4 text-sm text-[#9d4b45]">{authError}</p> : null}
              {ownerAccessError ? <p className="mt-4 text-sm text-[#9d4b45]">{ownerAccessError}</p> : null}
              {user && !ownerAuthorized ? (
                <p className="mt-4 text-sm text-[#9d4b45]">
                  {user.email} is signed in, but does not have owner access.
                </p>
              ) : null}
            </section>

            <aside className="rounded-[1.8rem] border border-[#e3d8c9] bg-white/80 p-8">
              <h3 className="brand-copy text-2xl text-[#3f4738]">Storefront scope</h3>
              <ul className="mt-5 space-y-3 text-sm leading-7 text-[#667056]">
                <li>Homepage content and visual story.</li>
                <li>Customer-facing category cards and product groups.</li>
                <li>Master data for fabrics, colours, and collection labels.</li>
              </ul>
            </aside>
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            <OwnerHomepageManager />
            <OwnerCategoryManager />
            <OwnerProductGroupManager />
            <OwnerProductMasterManager />
          </div>
        )}
      </div>
    </main>
  );
}
