"use client";
import { useEffect, useState } from "react";
import { selectCustomerAddress, subscribeToCustomerProfile } from "@/lib/customer-profiles";
import type { CustomerProfile } from "@/types/customer-profile";

export function SavedAddressSelector({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => subscribeToCustomerProfile(userId, setProfile, error => setError(error.message)), [userId]);
  if ((profile?.addresses?.length || 0) < 2) return error ? <p role="alert">{error}</p> : null;
  async function select(id: string) {
    setBusy(true); setError(null);
    try { await selectCustomerAddress(userId, id); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not select address."); }
    finally { setBusy(false); }
  }
  return <label className="mt-4 block text-sm">Deliver to
    <select aria-label="Saved delivery address" disabled={busy} value={profile?.selectedAddressId || ""} onChange={event => void select(event.target.value)} className="mt-2 block w-full rounded-xl border border-[#d7ccb9] bg-white p-3">
      {profile?.addresses?.map(address => <option key={address.id} value={address.id}>{address.label} — {address.address}, {address.city}</option>)}
    </select>
    {error ? <span role="alert" className="mt-2 block text-red-700">{error}</span> : null}
  </label>;
}
