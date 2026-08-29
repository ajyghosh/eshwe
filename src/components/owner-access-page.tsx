"use client";

import { useState } from "react";

import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { OwnerBackofficeNav } from "@/components/owner-backoffice-nav";
import { OwnerSectionHero } from "@/components/owner-section-hero";
import { firebaseReady } from "@/lib/firebase";
import { addOwnerAccount, normalizeOwnerEmail, removeOwnerAccount } from "@/lib/owner-access";
import { useOwnerAccess } from "@/lib/use-owner-access";

export function OwnerAccessPage() {
  const {
    authLoading,
    canManageOwnerAccounts,
    ownerAccessError,
    ownerAccounts,
    ownerAccountsLoading,
    ownerAuthorized,
    signIn,
    signOut,
    user
  } = useOwnerAccess();
  const [authError, setAuthError] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ownerEmailInput, setOwnerEmailInput] = useState("");
  const [isOwnerSaving, setIsOwnerSaving] = useState(false);
  const [isOwnerRemovingEmail, setIsOwnerRemovingEmail] = useState<string | null>(null);
  const [signOutPending, setSignOutPending] = useState(false);
  const [dialogState, setDialogState] = useState<
    | { type: "remove-owner"; email: string }
    | { type: "signout" }
    | null
  >(null);

  async function handleSignIn() {
    setAuthError(null);

    try {
      await signIn();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Google sign-in failed.");
    }
  }

  async function handleAddOwnerAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageOwnerAccounts) {
      setAccessError("Only the primary owner can manage additional owner accounts.");
      return;
    }

    const nextEmail = normalizeOwnerEmail(ownerEmailInput);

    if (!nextEmail) {
      setAccessError("Owner email is required.");
      return;
    }

    setIsOwnerSaving(true);
    setAccessError(null);
    setNotice(null);

    try {
      await addOwnerAccount(nextEmail, user?.email);
      setOwnerEmailInput("");
      setNotice(`${nextEmail} can now access the owner dashboard.`);
    } catch (error) {
      setAccessError(error instanceof Error ? error.message : "Saving owner email failed.");
    } finally {
      setIsOwnerSaving(false);
    }
  }

  async function handleDialogConfirm() {
    if (!dialogState) {
      return;
    }

    if (dialogState.type === "signout") {
      setSignOutPending(true);

      try {
        await signOut();
        setDialogState(null);
      } finally {
        setSignOutPending(false);
      }

      return;
    }

    setIsOwnerRemovingEmail(dialogState.email);
    setAccessError(null);
    setNotice(null);

    try {
      await removeOwnerAccount(dialogState.email);
      setNotice(`${dialogState.email} was removed from owner access.`);
      setDialogState(null);
    } catch (error) {
      setAccessError(error instanceof Error ? error.message : "Removing owner email failed.");
    } finally {
      setIsOwnerRemovingEmail(null);
    }
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
          eyebrow="OWNER ACCESS"
          title="Control which authorized Gmail accounts can enter the admin area."
          description="Keep access management out of the catalogue workspace. This page is only for owner authorization and account-level admin control."
          action={
            user ? (
              <button
                type="button"
                onClick={() => setDialogState({ type: "signout" })}
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
              <h2 className="brand-copy text-3xl text-[#3f4738]">Sign in to manage owner access</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#667056]">
                Use Google login with an authorized owner account to manage who can enter the admin
                area.
              </p>
              {user ? (
                <button
                  type="button"
                  onClick={() => setDialogState({ type: "signout" })}
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
              <h3 className="brand-copy text-2xl text-[#3f4738]">Access notes</h3>
              <ul className="mt-5 space-y-3 text-sm leading-7 text-[#667056]">
                <li>Primary owner email can add or remove extra owner accounts.</li>
                <li>Additional authorized accounts can access the owner area after Google sign-in.</li>
                <li>Keep this list tight to reduce operational risk.</li>
              </ul>
            </aside>
          </div>
        ) : (
          <section className="mt-8 rounded-[1.9rem] border border-[#ddd1c0] bg-[#fffaf2] p-7 shadow-[0_18px_40px_rgba(94,104,79,0.06)] sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="brand-copy text-3xl text-[#2b2a29]">Authorized owner accounts</h2>
                <p className="mt-2 text-sm leading-7 text-[#667056]">
                  Add or remove Gmail IDs that should be allowed into the owner backoffice.
                </p>
              </div>
              <span className="rounded-full bg-[#f5eee2] px-4 py-2 text-xs font-semibold text-[#5e684f]">
                {ownerAccounts.length} account{ownerAccounts.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
              <form className="space-y-4" onSubmit={handleAddOwnerAccount}>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#4f5942]">Owner Gmail ID</span>
                  <input
                    value={ownerEmailInput}
                    onChange={(event) => setOwnerEmailInput(event.target.value)}
                    className={inputClassName}
                    placeholder="owner@gmail.com"
                    type="email"
                  />
                </label>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={!canManageOwnerAccounts || isOwnerSaving}
                    className="brand-caption rounded-2xl bg-[#5e684f] px-5 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#fbf4e8] disabled:opacity-60"
                  >
                    {isOwnerSaving ? "ADDING..." : "ADD OWNER"}
                  </button>
                  {!canManageOwnerAccounts ? (
                    <p className="self-center text-xs text-[#667056]">Only the primary owner can change owner access.</p>
                  ) : null}
                </div>

                {accessError ? <p className="text-sm text-[#9d4b45]">{accessError}</p> : null}
                {notice ? <p className="text-sm text-[#4d6a41]">{notice}</p> : null}
                {ownerAccessError ? <p className="text-sm text-[#9d4b45]">{ownerAccessError}</p> : null}
              </form>

              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-[#4f5942]">Current access list</p>
                  <p className="mt-2 text-xs leading-6 text-[#667056]">
                    Additional Gmail IDs currently allowed into the owner admin.
                  </p>
                </div>

                {ownerAccountsLoading ? (
                  <p className="text-sm text-[#667056]">Loading owner accounts…</p>
                ) : ownerAccounts.length === 0 ? (
                  <div className="rounded-[1.3rem] border border-dashed border-[#d8cbb7] bg-[#fbf4e8] p-5 text-sm leading-7 text-[#667056]">
                    No additional owner accounts added yet.
                  </div>
                ) : (
                  ownerAccounts.map((owner) => (
                    <div
                      key={owner.id ?? owner.email}
                      className="flex flex-col gap-3 rounded-[1.25rem] border border-[#e5d8c8] bg-[#fbf4e8] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[#3f4738]">{owner.email}</p>
                        <p className="mt-1 text-xs text-[#667056]">Additional owner access</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDialogState({ type: "remove-owner", email: owner.email })}
                        disabled={!canManageOwnerAccounts || isOwnerRemovingEmail === owner.email}
                        className="brand-caption rounded-full border border-[#d4c5b2] px-4 py-2 text-[0.52rem] font-semibold tracking-[0.08em] text-[#9d4b45] disabled:opacity-60"
                      >
                        {isOwnerRemovingEmail === owner.email ? "REMOVING..." : "REMOVE"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      <ConfirmationDialog
        open={Boolean(dialogState)}
        title={dialogState?.type === "signout" ? "Sign out of the owner panel?" : "Remove owner access?"}
        message={
          dialogState?.type === "signout"
            ? "You will be signed out of the owner dashboard on this device."
            : `${dialogState?.email || "This account"} will no longer be able to sign in to the owner dashboard.`
        }
        confirmLabel={dialogState?.type === "signout" ? "SIGN OUT" : "REMOVE ACCESS"}
        tone={dialogState?.type === "signout" ? "neutral" : "danger"}
        pending={
          (dialogState?.type === "signout" && signOutPending) ||
          (dialogState?.type === "remove-owner" && isOwnerRemovingEmail === dialogState.email)
        }
        onConfirm={handleDialogConfirm}
        onClose={() => setDialogState(null)}
      />
    </main>
  );
}

const inputClassName =
  "h-[52px] w-full rounded-[1rem] border border-[#d9ccb8] bg-white/70 px-4 text-sm text-[#3f4738] outline-none transition-colors duration-200 placeholder:text-[#948978] focus:border-[#5e684f]";
