"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { useRouter } from "next/navigation";

import {
  isPrimaryOwnerEmail,
  normalizeEmail,
  signInAsOwner,
  signOutOwner,
  subscribeToAuth
} from "@/lib/auth";
import {
  normalizeOwnerEmail,
  subscribeToOwnerAccounts,
  type OwnerAccount
} from "@/lib/owner-access";

export function useOwnerAccess() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [ownerAccounts, setOwnerAccounts] = useState<OwnerAccount[]>([]);
  const [ownerAccountsLoading, setOwnerAccountsLoading] = useState(true);
  const [ownerAccessError, setOwnerAccessError] = useState<string | null>(null);

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
  const ownerAuthorized = useMemo(
    () =>
      isPrimaryOwnerEmail(user?.email) ||
      ownerAccounts.some((owner) => normalizeOwnerEmail(owner.email) === normalizedUserEmail),
    [normalizedUserEmail, ownerAccounts, user?.email]
  );
  const canManageOwnerAccounts = isPrimaryOwnerEmail(user?.email);

  async function handleSignOut() {
    await signOutOwner();
    router.replace("/owner");
  }

  return {
    authLoading,
    canManageOwnerAccounts,
    ownerAccessError,
    ownerAccounts,
    ownerAccountsLoading,
    ownerAuthorized,
    signIn: signInAsOwner,
    signOut: handleSignOut,
    user
  };
}
