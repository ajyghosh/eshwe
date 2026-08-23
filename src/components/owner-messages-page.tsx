"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";

import {
  isPrimaryOwnerEmail,
  normalizeEmail,
  signInAsOwner,
  signOutOwner,
  subscribeToAuth
} from "@/lib/auth";
import { subscribeToCustomerMessages } from "@/lib/customer-messages";
import { firebaseReady } from "@/lib/firebase";
import {
  normalizeOwnerEmail,
  subscribeToOwnerAccounts,
  type OwnerAccount
} from "@/lib/owner-access";
import type { CustomerMessage } from "@/types/customer-message";

export function OwnerMessagesPage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [ownerAccounts, setOwnerAccounts] = useState<OwnerAccount[]>([]);
  const [ownerAccountsLoading, setOwnerAccountsLoading] = useState(true);
  const [messages, setMessages] = useState<CustomerMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [ownerAccessError, setOwnerAccessError] = useState<string | null>(null);
  const [messagesError, setMessagesError] = useState<string | null>(null);

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
      setMessages([]);
      setMessagesLoading(false);
      setMessagesError(null);
      return;
    }

    setMessagesLoading(true);

    return subscribeToCustomerMessages(
      (nextMessages) => {
        setMessages(nextMessages);
        setMessagesLoading(false);
      },
      (error) => {
        setMessages([]);
        setMessagesLoading(false);
        setMessagesError(error.message);
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
        <section className="rounded-[2.2rem] bg-[#5a6851] p-8 text-[#f8ecd2] shadow-[0_30px_80px_rgba(79,89,66,0.18)]">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="brand-caption text-[0.68rem] font-semibold tracking-[0.22em] text-[#f3dfaa]">
                OWNER MESSAGES
              </p>
              <h1 className="brand-copy mt-4 text-4xl leading-[1.05] text-[#f8ecd2] sm:text-5xl">
                Customer message inbox
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#f8f1e3]/84 sm:text-[0.95rem]">
                View storefront contact submissions here without crowding the main owner dashboard.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/owner/"
                className="brand-caption inline-flex rounded-2xl border border-[#f8ecd2]/28 px-5 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#f8ecd2]"
              >
                BACK TO DASHBOARD
              </Link>
              {user ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="brand-caption rounded-2xl bg-[#f8ecd2] px-5 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#5a6851]"
                >
                  SIGN OUT
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {authLoading || (user && !isPrimaryOwnerEmail(user?.email) && ownerAccountsLoading) ? (
          <div className="mt-10 rounded-[1.8rem] border border-[#e3d8c9] bg-[#f8f0e3] p-8 text-sm text-[#667056]">
            Checking Google session…
          </div>
        ) : !ownerAuthorized ? (
          <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-[1.8rem] border border-[#e3d8c9] bg-[#f8f0e3] p-8">
              <h2 className="brand-copy text-3xl text-[#3f4738]">Sign in to view messages</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#667056]">
                Use Google login with an authorized owner account to open the customer inbox.
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
              <h3 className="brand-copy text-2xl text-[#3f4738]">Inbox notes</h3>
              <ul className="mt-5 space-y-3 text-sm leading-7 text-[#667056]">
                <li>Messages come from the storefront contact form.</li>
                <li>Each entry shows contact details, source page, and submitted time.</li>
                <li>Use the main dashboard for catalogue work and this page only for follow-up.</li>
              </ul>
            </aside>
          </div>
        ) : (
          <section className="mt-10 rounded-[1.8rem] border border-[#e3d8c9] bg-white/70 p-7 sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="brand-copy text-2xl text-[#3f4738]">Customer messages</h2>
                <p className="mt-2 text-sm leading-7 text-[#667056]">
                  Contact form submissions from the storefront appear here for follow-up.
                </p>
              </div>
              <span className="rounded-full bg-[#f8f0e3] px-4 py-2 text-xs font-semibold text-[#5e684f]">
                {messages.length} message{messages.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {messagesError ? <p className="text-sm text-[#9d4b45]">{messagesError}</p> : null}
              {messagesLoading ? (
                <p className="text-sm text-[#667056]">Loading customer messages…</p>
              ) : messages.length === 0 ? (
                <div className="rounded-[1.3rem] border border-dashed border-[#d8cbb7] bg-[#fbf4e8] p-5 text-sm leading-7 text-[#667056]">
                  No customer messages yet.
                </div>
              ) : (
                messages.map((message) => (
                  <article
                    key={message.id}
                    className="rounded-[1.35rem] border border-[#e8dccd] bg-[#fbf4e8] p-5 shadow-[0_10px_25px_rgba(94,104,79,0.04)]"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-[#3f4738]">{message.email}</p>
                          <span className="rounded-full bg-[#efe4c6] px-2.5 py-1 text-[0.68rem] font-semibold text-[#5e684f]">
                            NEW
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-[#667056]">{message.phone}</p>
                      </div>

                      <div className="text-left text-xs text-[#667056] sm:text-right">
                        <p>{message.sourcePath || "/"}</p>
                        <p className="mt-1">{formatTimestamp(message.createdAt)}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[1.1rem] bg-white/72 px-4 py-4 text-sm leading-7 text-[#4f5942]">
                      {message.message}
                    </div>
                  </article>
                ))
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
