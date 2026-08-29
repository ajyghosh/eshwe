"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

import { useAuthSession } from "@/components/auth-provider";
import { getCustomerProfile, saveCustomerFavoriteSkus } from "@/lib/customer-profiles";

const FAVORITES_STORAGE_KEY = "eshwe-favorites-v1";

type FavoritesContextValue = {
  favoriteSkus: string[];
  favoritesCount: number;
  isReady: boolean;
  isFavorite: (sku: string) => boolean;
  toggleFavorite: (sku: string) => void;
  removeFavoriteSkus: (skus: string[]) => void;
  clearFavorites: () => void;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthSession();
  const [favoriteSkus, setFavoriteSkus] = useState<string[]>([]);
  const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null);
  const storageKey = user?.uid ? `${FAVORITES_STORAGE_KEY}:${user.uid}` : `${FAVORITES_STORAGE_KEY}:guest`;
  const guestStorageKey = `${FAVORITES_STORAGE_KEY}:guest`;
  const favoriteSkusRef = useRef(favoriteSkus);
  const previousStorageKeyRef = useRef<string | null>(null);

  useEffect(() => {
    favoriteSkusRef.current = favoriteSkus;
  }, [favoriteSkus]);

  useEffect(() => {
    if (loading || typeof window === "undefined") {
      return;
    }

    const previousStorageKey = previousStorageKeyRef.current;
    let cancelled = false;
    setHydratedStorageKey(null);

    async function hydrateFavorites() {
      try {
        if (user?.uid) {
          const accountFavorites = readStoredFavorites(storageKey);
          const guestFavorites = readStoredFavorites(guestStorageKey);
          const nextGuestFavorites =
            previousStorageKey === guestStorageKey
              ? mergeFavoriteSkus(favoriteSkusRef.current, guestFavorites)
              : guestFavorites;
          let profileFavorites: string[] = [];

          try {
            const customerProfile = await getCustomerProfile(user.uid);
            profileFavorites = customerProfile?.favoriteSkus ?? [];
          } catch {
            profileFavorites = [];
          }

          const mergedFavorites = mergeFavoriteSkus(
            profileFavorites,
            mergeFavoriteSkus(accountFavorites, nextGuestFavorites)
          );

          window.localStorage.setItem(storageKey, JSON.stringify(mergedFavorites));

          if (nextGuestFavorites.length > 0) {
            window.localStorage.removeItem(guestStorageKey);
          }

          if (!cancelled) {
            setFavoriteSkus(mergedFavorites);
          }
        } else {
          const guestFavorites = readStoredFavorites(guestStorageKey);
          const nextGuestFavorites =
            previousStorageKey && previousStorageKey !== guestStorageKey
              ? mergeFavoriteSkus(favoriteSkusRef.current, guestFavorites)
              : guestFavorites;

          window.localStorage.setItem(guestStorageKey, JSON.stringify(nextGuestFavorites));

          if (!cancelled) {
            setFavoriteSkus(nextGuestFavorites);
          }
        }
      } catch {
        window.localStorage.removeItem(storageKey);

        if (storageKey !== guestStorageKey) {
          window.localStorage.removeItem(guestStorageKey);
        }

        if (!cancelled) {
          setFavoriteSkus([]);
        }
      } finally {
        if (!cancelled) {
          setHydratedStorageKey(storageKey);
          previousStorageKeyRef.current = storageKey;
        }
      }
    }

    void hydrateFavorites();

    return () => {
      cancelled = true;
    };
  }, [guestStorageKey, loading, storageKey, user?.uid]);

  useEffect(() => {
    if (hydratedStorageKey !== storageKey || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(favoriteSkus));
  }, [favoriteSkus, hydratedStorageKey, storageKey]);

  useEffect(() => {
    if (!user?.uid || hydratedStorageKey !== storageKey) {
      return;
    }

    void saveCustomerFavoriteSkus(user.uid, favoriteSkus).catch(() => undefined);
  }, [favoriteSkus, hydratedStorageKey, storageKey, user?.uid]);

  const value = useMemo<FavoritesContextValue>(
    () => ({
      favoriteSkus,
      favoritesCount: favoriteSkus.length,
      isReady: hydratedStorageKey === storageKey,
      isFavorite(sku) {
        return favoriteSkus.includes(sku);
      },
      toggleFavorite(sku) {
        const normalizedSku = sku.trim();

        if (!normalizedSku) {
          return;
        }

        setFavoriteSkus((currentFavoriteSkus) =>
          currentFavoriteSkus.includes(normalizedSku)
            ? currentFavoriteSkus.filter((entry) => entry !== normalizedSku)
            : [...currentFavoriteSkus, normalizedSku]
        );
      },
      removeFavoriteSkus(skus) {
        const nextSkus = normalizeFavoriteSkus(skus);

        if (nextSkus.length === 0) {
          return;
        }

        setFavoriteSkus((currentFavoriteSkus) =>
          currentFavoriteSkus.filter((entry) => !nextSkus.includes(entry))
        );
      },
      clearFavorites() {
        setFavoriteSkus([]);
      }
    }),
    [favoriteSkus, hydratedStorageKey, storageKey]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);

  if (!context) {
    throw new Error("useFavorites must be used within FavoritesProvider.");
  }

  return context;
}

function readStoredFavorites(storageKey: string) {
  if (typeof window === "undefined") {
    return [];
  }

  const savedFavorites = window.localStorage.getItem(storageKey);

  if (!savedFavorites) {
    return [];
  }

  const parsedFavorites = JSON.parse(savedFavorites) as unknown;

  return normalizeFavoriteSkus(parsedFavorites);
}

function normalizeFavoriteSkus(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenSkus = new Set<string>();

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .filter((entry) => {
      if (seenSkus.has(entry)) {
        return false;
      }

      seenSkus.add(entry);
      return true;
    });
}

function mergeFavoriteSkus(primarySkus: string[], secondarySkus: string[]) {
  return normalizeFavoriteSkus([...primarySkus, ...secondarySkus]);
}
