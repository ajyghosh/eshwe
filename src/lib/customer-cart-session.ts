import { normalizeCart } from "@/lib/cart-state";
import { migrateCustomerCart, saveCustomerCartMutation, subscribeToCustomerProfile } from "@/lib/customer-profiles";
import { applyCartMutation, createCartMutation, type CartMutation } from "@/lib/cart-mutations";
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
  let pendingRecovery = 0;
  let journalFailed = false;
  const journalPrefix = `eshwe-cart-pending:${encodeURIComponent(uid)}:`;
  type Job = { id: string; createdAt: number; mutation: CartMutation };
  const savedChanges = new Map<(items: CartItem[]) => CartItem[], Job>();
  const recoveringIds = new Set<string>();
  const publish = () => {
    if (active) render(currentItems, pendingChanges || pendingMigrations > 0 || pendingRecovery > 0, receivedSnapshot && pendingMigrations === 0 && pendingRecovery === 0 && !migrationFailed && !journalFailed);
  };
  const sync = createOptimisticList<CartItem>(
    async change => {
      if (journalFailed) throw Error("An earlier bag change still needs syncing.");
      const job = savedChanges.get(change)!;
      const snapshot = await saveCustomerCartMutation(uid, job.id, job.mutation);
      storage.removeItem(journalPrefix + job.id);
      savedChanges.delete(change);
      if (recoveringIds.delete(job.id)) pendingRecovery -= 1;
      return snapshot;
    },
    (items, pending) => { currentItems = items; pendingChanges = pending; publish(); },
    () => {
      journalFailed = true;
      if (active) failed("Your bag change is saved on this device. Reconnect and reload to finish syncing.");
      publish();
    }
  );

  const recoveryJobs: Job[] = [];
  try {
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key?.startsWith(journalPrefix)) {
        const job = JSON.parse(storage.getItem(key) || "null") as Job;
        if (!job || key !== journalPrefix + job.id || !Number.isFinite(job.createdAt) ||
          !Array.isArray(job.mutation?.changes) || !Array.isArray(job.mutation?.removed) ||
          !job.mutation.removed.every(value => typeof value === "string") ||
          !job.mutation.changes.every(value => value && Number.isInteger(value.delta) && Math.abs(value.delta) <= 10 && normalizeCart([value.item]).length === 1)) {
          throw Error("Invalid bag journal");
        }
        recoveryJobs.push(job);
      }
    }
    recoveryJobs.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  } catch {
    journalFailed = true;
    failed("Your saved bag changes could not be read. Please allow site storage and reload.");
  }
  pendingRecovery = recoveryJobs.length;
  for (const job of recoveryJobs) recoveringIds.add(job.id);
  let sequenceTime = recoveryJobs.at(-1)?.createdAt || 0;
  function enqueue(job: Job) {
    const change = (items: CartItem[]) => applyCartMutation(items, job.mutation);
    savedChanges.set(change, job);
    sync.change(change);
  }

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
    // Do not expose an empty ready cart before the journal has been replayed.
    if (recoveryJobs.length) {
      for (const job of recoveryJobs.splice(0)) enqueue(job);
      // Recovery stays unresolved until the pending writes are acknowledged.
    }
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
    change(change: (items: CartItem[]) => CartItem[]) {
      if (!active || journalFailed) return;
      const mutation = createCartMutation(currentItems, change(currentItems));
      if (!mutation.removed.length && !mutation.changes.length) return;
      const job = { id: crypto.randomUUID(), createdAt: sequenceTime = Math.max(Date.now(), sequenceTime + 1), mutation };
      try {
        storage.setItem(journalPrefix + job.id, JSON.stringify(job));
      } catch {
        failed("Your browser could not save the bag change. Please allow site storage and try again.");
        return;
      }
      enqueue(job);
    },
    dispose() { active = false; sync.dispose(); unsubscribe(); }
  };
}
