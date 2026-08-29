"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";

import { OwnerBackofficeNav } from "@/components/owner-backoffice-nav";
import { OwnerSectionHero } from "@/components/owner-section-hero";
import {
  isPrimaryOwnerEmail,
  normalizeEmail,
  signInAsOwner,
  signOutOwner,
  subscribeToAuth
} from "@/lib/auth";
import { firebaseReady } from "@/lib/firebase";
import {
  normalizeOwnerEmail,
  subscribeToOwnerAccounts,
  type OwnerAccount
} from "@/lib/owner-access";
import { buildProductDetailHref } from "@/lib/storefront-routes";
import { subscribeToWaitlistEntries } from "@/lib/waitlist";
import type { WaitlistEntry } from "@/types/waitlist-entry";

export function OwnerWaitlistPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [ownerAccounts, setOwnerAccounts] = useState<OwnerAccount[]>([]);
  const [ownerAccountsLoading, setOwnerAccountsLoading] = useState(true);
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [ownerAccessError, setOwnerAccessError] = useState<string | null>(null);
  const [entriesError, setEntriesError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToAuth((nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setOwnerAccounts([]);
      setOwnerAccountsLoading(false);
      setOwnerAccessError(null);
      return;
    }

    setOwnerAccountsLoading(true);

    return subscribeToOwnerAccounts(
      (nextOwners) => {
        setOwnerAccounts(nextOwners);
        setOwnerAccountsLoading(false);
      },
      (error) => {
        setOwnerAccounts([]);
        setOwnerAccountsLoading(false);
        setOwnerAccessError(error.message);
      }
    );
  }, [user]);

  const normalizedUserEmail = normalizeEmail(user?.email);
  const ownerAuthorized =
    isPrimaryOwnerEmail(user?.email) ||
    ownerAccounts.some((owner) => normalizeOwnerEmail(owner.email) === normalizedUserEmail);

  useEffect(() => {
    if (!user || !ownerAuthorized) {
      setEntries([]);
      setEntriesLoading(false);
      setEntriesError(null);
      return;
    }

    setEntriesLoading(true);

    return subscribeToWaitlistEntries(
      (nextEntries) => {
        setEntries(nextEntries);
        setEntriesLoading(false);
      },
      (error) => {
        setEntries([]);
        setEntriesLoading(false);
        setEntriesError(error.message);
      }
    );
  }, [ownerAuthorized, user]);

  async function handleSignIn() {
    setAuthError(null);

    try {
      await signInAsOwner();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Google sign-in failed.");
    }
  }

  async function handleSignOut() {
    await signOutOwner();
    router.replace("/owner");
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
    <main className="min-h-screen bg-[#fbf4e8] px-6 py-12 text-[#4f5942] sm:px-10 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <OwnerSectionHero
          eyebrow="OWNER WAITLIST"
          title="Back-in-stock requests"
          description="Review shoppers who asked to be notified when an out-of-stock saree becomes available again."
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

        {ownerAuthorized ? (
          <OwnerBackofficeNav className="mt-6" badges={{ "/owner/waitlist": entries.length }} />
        ) : null}

        {authLoading || (user && !isPrimaryOwnerEmail(user?.email) && ownerAccountsLoading) ? (
          <div className="mt-10 rounded-[1.8rem] border border-[#e3d8c9] bg-[#f8f0e3] p-8 text-sm text-[#667056]">
            Checking Google session…
          </div>
        ) : !ownerAuthorized ? (
          <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-[1.8rem] border border-[#e3d8c9] bg-[#f8f0e3] p-8">
              <h2 className="brand-copy text-3xl text-[#3f4738]">Sign in to view the waitlist</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#667056]">
                Use Google login with an authorized owner account to open the waitlist inbox.
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

            <aside className="rounded-[1.8rem] border border-[#e3d8c9] bg-white/70 p-8">
              <h3 className="brand-copy text-2xl text-[#3f4738]">Waitlist notes</h3>
              <ul className="mt-5 space-y-3 text-sm leading-7 text-[#667056]">
                <li>Entries are created from `Notify Me` actions on out-of-stock products.</li>
                <li>Each request stores product details, contact info, source page, and submission time.</li>
                <li>Use this list to reach out manually when inventory is replenished.</li>
              </ul>
            </aside>
          </div>
        ) : (
          <section className="mt-10 rounded-[1.8rem] border border-[#e3d8c9] bg-white/70 p-7 sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="brand-copy text-2xl text-[#3f4738]">Waitlist requests</h2>
                <p className="mt-2 text-sm leading-7 text-[#667056]">
                  Notify-me requests from out-of-stock product views appear here for follow-up.
                </p>
              </div>
              <span className="rounded-full bg-[#f8f0e3] px-4 py-2 text-xs font-semibold text-[#5e684f]">
                {entries.length} request{entries.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-6">
              {entriesError ? <p className="text-sm text-[#9d4b45]">{entriesError}</p> : null}
              {entriesLoading ? (
                <p className="text-sm text-[#667056]">Loading waitlist requests…</p>
              ) : entries.length === 0 ? (
                <div className="rounded-[1.3rem] border border-dashed border-[#d8cbb7] bg-[#fbf4e8] p-5 text-sm leading-7 text-[#667056]">
                  No waitlist requests yet.
                </div>
              ) : (
                <div className="overflow-hidden rounded-[1.5rem] border border-[#e3d8c9] bg-[#fffaf1]">
                  <div className="hidden grid-cols-[1.2fr_0.95fr_1fr_0.9fr_0.8fr] gap-4 border-b border-[#e8dccd] bg-[#f6edde] px-5 py-4 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#7d876f] lg:grid">
                    <span>Product</span>
                    <span>SKU</span>
                    <span>Contact</span>
                    <span>Received</span>
                    <span>Action</span>
                  </div>

                  <div className="divide-y divide-[#ece1d3]">
                    {entries.map((entry) => (
                      <article
                        key={entry.id}
                        className="grid gap-4 px-5 py-4 text-sm text-[#4f5942] lg:grid-cols-[1.2fr_0.95fr_1fr_0.9fr_0.8fr] lg:items-center"
                      >
                        <div className="min-w-0">
                          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#8a836f] lg:hidden">
                            Product
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold text-[#2b2a29]">{entry.productName}</p>
                            <span className="rounded-full bg-[#efe4c6] px-2.5 py-1 text-[0.68rem] font-semibold text-[#5e684f]">
                              NEW
                            </span>
                          </div>
                          <p className="mt-1 truncate text-xs text-[#667056]">{entry.productCategory}</p>
                        </div>

                        <div>
                          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#8a836f] lg:hidden">
                            SKU
                          </p>
                          <p>{entry.productSku}</p>
                        </div>

                        <div className="min-w-0">
                          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#8a836f] lg:hidden">
                            Contact
                          </p>
                          <p className="truncate">{entry.email || entry.phone || "NA"}</p>
                          {entry.email && entry.phone ? (
                            <p className="mt-1 truncate text-xs text-[#667056]">{entry.phone}</p>
                          ) : null}
                        </div>

                        <div>
                          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#8a836f] lg:hidden">
                            Received
                          </p>
                          <p>{formatTimestamp(entry.createdAt)}</p>
                        </div>

                        <div>
                          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#8a836f] lg:hidden">
                            Action
                          </p>
                          <Link
                            href={buildProductDetailHref(entry.productSlug)}
                            className="brand-caption inline-flex rounded-full bg-[#5e684f] px-4 py-2 text-[0.52rem] font-semibold tracking-[0.08em] text-[#fbf4e8]"
                          >
                            VIEW PRODUCT
                          </Link>
                          <p className="mt-2 truncate text-xs text-[#667056]">
                            {formatWaitlistSourcePath(entry.sourcePath, entry.productSlug)}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function formatTimestamp(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value) || typeof value.toDate !== "function") {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value.toDate());
}

function formatWaitlistSourcePath(sourcePath: string, productSlug: string) {
  const normalizedPath = sourcePath.trim();

  if (
    normalizedPath &&
    normalizedPath !== "." &&
    normalizedPath !== "/" &&
    normalizedPath !== "/product" &&
    normalizedPath !== "/product/"
  ) {
    return normalizedPath;
  }

  return buildProductDetailHref(productSlug);
}
