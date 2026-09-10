"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
import {
  getUnreadCustomerMessageCount,
  isUnreadCustomerMessage,
  subscribeToCustomerMessages,
  updateCustomerMessageStatus
} from "@/lib/customer-messages";
import { firebaseReady } from "@/lib/firebase";
import {
  normalizeOwnerEmail,
  subscribeToOwnerAccounts,
  type OwnerAccount
} from "@/lib/owner-access";
import { useOwnerBackofficeBadges } from "@/lib/use-owner-backoffice-badges";
import type { CustomerMessage } from "@/types/customer-message";

export function OwnerMessagesPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [ownerAccounts, setOwnerAccounts] = useState<OwnerAccount[]>([]);
  const [ownerAccountsLoading, setOwnerAccountsLoading] = useState(true);
  const [messages, setMessages] = useState<CustomerMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [ownerAccessError, setOwnerAccessError] = useState<string | null>(null);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [messageActionError, setMessageActionError] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [updatingMessageId, setUpdatingMessageId] = useState<string | null>(null);

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
  const { badges: navBadges } = useOwnerBackofficeBadges(ownerAuthorized);

  useEffect(() => {
    if (!user || !ownerAuthorized) {
      setMessages([]);
      setMessagesLoading(false);
      setMessagesError(null);
      setSelectedMessageId(null);
      setMessageActionError(null);
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

  useEffect(() => {
    if (!selectedMessageId) {
      return;
    }

    if (!messages.some((message) => message.id === selectedMessageId)) {
      setSelectedMessageId(null);
    }
  }, [messages, selectedMessageId]);

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

  async function handleViewMessage(message: CustomerMessage) {
    setSelectedMessageId(message.id ?? null);
    setMessageActionError(null);

    if (!message.id || !isUnreadCustomerMessage(message)) {
      return;
    }

    setUpdatingMessageId(message.id);

    try {
      await updateCustomerMessageStatus(message.id, "read");
    } catch (error) {
      setMessageActionError(error instanceof Error ? error.message : "Unable to update the message status.");
    } finally {
      setUpdatingMessageId(null);
    }
  }

  const unreadMessagesCount = useMemo(() => getUnreadCustomerMessageCount(messages), [messages]);
  const selectedMessage = useMemo(
    () => messages.find((message) => message.id === selectedMessageId) ?? null,
    [messages, selectedMessageId]
  );

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
      <div className="mx-auto max-w-7xl">
        <OwnerSectionHero
          eyebrow="OWNER MESSAGES"
          title="Messages"
          description="Read customer enquiries and review unread messages."
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

        {ownerAuthorized ? <OwnerBackofficeNav className="mt-6" badges={navBadges} /> : null}

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
                <li>Unread customer notes stay highlighted until they are opened.</li>
                <li>Use the queue on the left, then review the full message in the detail panel.</li>
                <li>The owner navigation badge shows how many messages still need review.</li>
              </ul>
            </aside>
          </div>
        ) : (
          <section className="mt-10 rounded-[1.8rem] border border-[#e3d8c9] bg-white/70 p-7 sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="brand-copy text-2xl text-[#3f4738]">Customer messages</h2>
                <p className="mt-2 text-sm leading-7 text-[#667056]">
                  Review contact submissions in a structured queue, then open the full note on the side.
                </p>
              </div>
              <span className="rounded-full bg-[#f8f0e3] px-4 py-2 text-xs font-semibold text-[#5e684f]">
                {messagesLoading ? "..." : unreadMessagesCount > 0 ? `${unreadMessagesCount} unread` : "All read"}
              </span>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
              <div>
                {messagesError ? <p className="text-sm text-[#9d4b45]">{messagesError}</p> : null}
                {messageActionError ? <p className="mt-2 text-sm text-[#9d4b45]">{messageActionError}</p> : null}
                {messagesLoading ? (
                  <p className="text-sm text-[#667056]">Loading customer messages…</p>
                ) : messages.length === 0 ? (
                  <div className="rounded-[1.3rem] border border-dashed border-[#d8cbb7] bg-[#fbf4e8] p-5 text-sm leading-7 text-[#667056]">
                    No customer messages yet.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-[1.5rem] border border-[#e3d8c9] bg-[#fffaf1]">
                    <div className="hidden grid-cols-[1.1fr_0.95fr_0.9fr_0.9fr_0.75fr] gap-4 border-b border-[#e8dccd] bg-[#f6edde] px-5 py-4 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#7d876f] lg:grid">
                      <span>Contact</span>
                      <span>Phone</span>
                      <span>Received</span>
                      <span>Action</span>
                      <span>Status</span>
                    </div>

                    <div className="divide-y divide-[#ece1d3]">
                      {messages.map((message) => {
                        const isUnread = isUnreadCustomerMessage(message);
                        const isSelected = selectedMessageId === message.id;

                        return (
                          <article
                            key={message.id ?? `${message.email}-${message.phone}-${message.sourcePath}`}
                            className={`grid gap-4 px-5 py-5 text-sm text-[#4f5942] lg:grid-cols-[1.1fr_0.95fr_0.9fr_0.9fr_0.75fr] lg:items-center ${
                              isUnread ? "bg-[#fff4ee]" : isSelected ? "bg-[#fcf6ea]" : "bg-transparent"
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#8a836f] lg:hidden">
                                Contact
                              </p>
                              <p className="truncate font-semibold text-[#2b2a29]">{message.email}</p>
                              <p className="mt-1 truncate text-xs text-[#667056]">{message.sourcePath || "/"}</p>
                            </div>

                            <div>
                              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#8a836f] lg:hidden">
                                Phone
                              </p>
                              <p>{message.phone || "NA"}</p>
                            </div>

                            <div>
                              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#8a836f] lg:hidden">
                                Received
                              </p>
                              <p>{formatTimestamp(message.createdAt)}</p>
                            </div>

                            <div>
                              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#8a836f] lg:hidden">
                                Action
                              </p>
                              <button
                                type="button"
                                onClick={() => void handleViewMessage(message)}
                                disabled={updatingMessageId === message.id}
                                className="brand-caption inline-flex rounded-full border border-[#d6ccb9] bg-white/80 px-3 py-1.5 text-[0.5rem] font-semibold tracking-[0.08em] text-[#4f5942] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {updatingMessageId === message.id ? "OPENING..." : isSelected ? "OPEN" : "VIEW MESSAGE"}
                              </button>
                            </div>

                            <div>
                              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#8a836f] lg:hidden">
                                Status
                              </p>
                              <span
                                className={`inline-flex rounded-full px-3 py-1.5 text-[0.68rem] font-semibold ${
                                  isUnread ? "bg-[#a84c43] text-[#fff4ef]" : "bg-[#e6efe1] text-[#48603f]"
                                }`}
                              >
                                {isUnread ? "UNREAD" : "READ"}
                              </span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <aside className="rounded-[1.5rem] border border-[#e3d8c9] bg-[#fbf4e8] p-6 shadow-[0_10px_30px_rgba(94,104,79,0.04)] sm:p-7">
                <p className="brand-caption text-[0.58rem] font-semibold tracking-[0.16em] text-[#7d876f]">
                  MESSAGE DETAIL
                </p>
                {selectedMessage ? (
                  <>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <h3 className="brand-copy text-2xl text-[#2b2a29]">{selectedMessage.email}</h3>
                      <span
                        className={`inline-flex rounded-full px-3 py-1.5 text-[0.68rem] font-semibold ${
                          isUnreadCustomerMessage(selectedMessage)
                            ? "bg-[#a84c43] text-[#fff4ef]"
                            : "bg-[#e6efe1] text-[#48603f]"
                        }`}
                      >
                        {isUnreadCustomerMessage(selectedMessage) ? "UNREAD" : "READ"}
                      </span>
                    </div>

                    <div className="mt-5 space-y-3 text-sm text-[#4f5942]">
                      <DetailRow label="Phone" value={selectedMessage.phone || "NA"} />
                      <DetailRow label="Source page" value={selectedMessage.sourcePath || "/"} />
                      <DetailRow label="Received" value={formatTimestamp(selectedMessage.createdAt)} />
                    </div>

                    <div className="mt-6 rounded-[1.2rem] border border-[#e3d8c9] bg-white/80 px-4 py-4 text-sm leading-7 text-[#4f5942]">
                      {selectedMessage.message}
                    </div>
                  </>
                ) : (
                  <div className="mt-4 rounded-[1.2rem] border border-dashed border-[#d8cbb7] bg-white/70 p-5 text-sm leading-7 text-[#667056]">
                    Select <span className="font-semibold text-[#4f5942]">View message</span> on any row to open the full customer note here.
                  </div>
                )}
              </aside>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[1rem] bg-white/56 px-4 py-3">
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#8a836f]">{label}</p>
      <p>{value}</p>
    </div>
  );
}

function formatTimestamp(value: unknown) {
  const timestamp = getTimestampValue(value);

  if (!timestamp) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
}

function getTimestampValue(value: unknown) {
  if (!value || typeof value !== "object") {
    return 0;
  }

  if ("toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if ("toDate" in value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  return 0;
}
