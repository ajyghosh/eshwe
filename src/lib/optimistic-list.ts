export type ListChange<T> = (items: T[]) => T[];
export type ListSnapshot<T> = { items: T[]; revision: number };

// Keep taps responsive while transactions preserve edits from other devices.
// Buffer listener echoes while a write is pending so an optimistic addition is
// never applied twice. The revision orders transaction results against echoes.
export function createOptimisticList<T>(
  save: (change: ListChange<T>) => Promise<ListSnapshot<T>>,
  render: (items: T[], syncing: boolean) => void,
  failed: (error: unknown) => void
) {
  let confirmed: ListSnapshot<T> = { items: [], revision: 0 };
  let latest = confirmed;
  const pending: ListChange<T>[] = [];
  let running = false;
  let disposed = false;

  function publish() {
    if (!disposed) render(pending.reduce((items, change) => change(items), confirmed.items), pending.length > 0);
  }

  async function drain() {
    if (running || disposed) return;
    running = true;
    while (pending.length && !disposed) {
      try {
        const saved = await save(pending[0]);
        if (disposed) return;
        confirmed = latest.revision >= saved.revision ? latest : saved;
        latest = confirmed;
        pending.shift();
        publish();
      } catch (error) {
        if (disposed) return;
        confirmed = latest;
        pending.shift();
        publish();
        failed(error);
      }
    }
    running = false;
  }

  return {
    receive(snapshot: ListSnapshot<T>) {
      if (disposed || snapshot.revision < confirmed.revision) return;
      latest = snapshot;
      if (!pending.length) { confirmed = snapshot; publish(); }
    },
    change(change: ListChange<T>) {
      if (disposed) return;
      pending.push(change);
      publish();
      void drain();
    },
    dispose() { disposed = true; pending.length = 0; }
  };
}
