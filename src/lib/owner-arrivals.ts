// Establish a server-confirmed baseline, then announce each ID once per owner
// session. Cache hydration, edits, reconnects and route changes are not arrivals.
export function createOwnerArrivalTracker() {
  let initialized = false;
  const seen = new Set<string>();
  return (ids: string[], ready: boolean) => {
    if (!ready) return [];
    const added = initialized ? ids.filter(id => !seen.has(id)) : [];
    for (const id of ids) seen.add(id);
    initialized = true;
    return added;
  };
}
