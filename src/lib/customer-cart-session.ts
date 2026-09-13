import { normalizeCart } from "@/lib/cart-state";
import { changeCustomerCart, migrateCustomerCart, subscribeToCustomerProfile } from "@/lib/customer-profiles";
import { claimGuestData } from "@/lib/guest-migration";
import { createOptimisticList } from "@/lib/optimistic-list";
import type { CartItem } from "@/types/cart";

// An account's first snapshot can arrive before its guest bag is imported.
// Keep checkout unresolved until every import has supplied its saved snapshot.
export function createCustomerCartSession(
  uid: string,
  storage: Storage,
  guestKey: string,
  render: (items: CartItem[], syncing: boolean, ready: boolean) => void,
  failed: (message: string) => void
) {
  let active = true;
  let receivedSnapshot = false;
  let migrationFailed = false;
  let pendingMigrations = 0;
  let currentItems: CartItem[] = [];
  let pendingChanges = false;
  let latestRevision = -1;
  const publish = () => {
    if (active) render(currentItems, pendingChanges || pendingMigrations > 0, receivedSnapshot && pendingMigrations === 0 && !migrationFailed);
  };
  const sync = createOptimisticList<CartItem>(
    change => changeCustomerCart(uid, change),
    (items, pending) => { currentItems = items; pendingChanges = pending; publish(); },
    () => { if (active) failed("Your bag change could not be saved. Please try again."); }
  );

  const jobs: { key: string; id: string; items: CartItem[] }[] = [];
  try {
    jobs.push(...claimGuestData(storage, guestKey, uid).map(job => ({ ...job, items: normalizeCart(job.items) })));
    const legacyKey = `eshwe-cart-v1:${uid}`;
    // A malformed legacy cache must not prevent a valid guest bag import.
    try {
      const legacy = normalizeCart(JSON.parse(storage.getItem(legacyKey) || "[]"));
      if (legacy.length) jobs.push({ key: legacyKey, id: `legacy-${uid}`, items: legacy });
    } catch { /* Ignore malformed old browser data. */ }
  } catch {
    migrationFailed = true;
    failed("Your browser could not prepare bag syncing. Please allow site storage.");
  }
  pendingMigrations = jobs.length;
  publish();

  const unsubscribe = subscribeToCustomerProfile(uid, profile => {
    receivedSnapshot = true;
    const revision = profile?.cartRevision || 0;
    latestRevision = Math.max(latestRevision, revision);
    sync.receive({ items: profile?.cartItems || [], revision });
  }, error => { if (active) failed(error.message); });

  for (const job of jobs) {
    void migrateCustomerCart(uid, job.items, job.id).then(snapshot => {
      if (active) {
        receivedSnapshot = true;
        // A listener may already have observed this import and a subsequent
        // payment removing its items without advancing the cart revision.
        if (snapshot.revision > latestRevision) {
          latestRevision = snapshot.revision;
          sync.receive(snapshot);
        }
      }
      storage.removeItem(job.key);
    }).catch(() => {
      migrationFailed = true;
      if (active) failed("Your bag could not finish syncing. Check your connection and reload to try again.");
    }).finally(() => {
      pendingMigrations -= 1;
      publish();
    });
  }

  return {
    change: sync.change,
    dispose() { active = false; sync.dispose(); unsubscribe(); }
  };
}
