// Claim guest data synchronously at sign-in, before starting a network request.
// Failed migrations remain in an account-specific journal, never in the next
// customer's guest bag. A stable job ID makes retries safe after interruption.
export function claimGuestData(storage: Storage, guestKey: string, uid: string): { key: string; id: string; items: unknown[] }[] {
  const claimKey = `${guestKey}:claim`;
  const finishClaim = () => {
    const saved = storage.getItem(claimKey);
    if (!saved) return;
    const claim = JSON.parse(saved) as { uid: string; id: string; raw: string };
    storage.setItem(`${guestKey}:migration:${claim.uid}:${claim.id}`, claim.raw);
    if (storage.getItem(guestKey) === claim.raw) storage.removeItem(guestKey);
    storage.removeItem(claimKey);
  };
  finishClaim();
  const raw = storage.getItem(guestKey);
  if (raw && Array.isArray(JSON.parse(raw)) && JSON.parse(raw).length) {
    storage.setItem(claimKey, JSON.stringify({ uid, id: crypto.randomUUID(), raw }));
    finishClaim();
  }
  const prefix = `${guestKey}:migration:${uid}:`;
  const jobs = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) jobs.push({ key, id: key.slice(prefix.length), items: JSON.parse(storage.getItem(key) || "[]") as unknown[] });
  }
  return jobs;
}
