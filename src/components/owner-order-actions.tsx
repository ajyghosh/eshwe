"use client";
import { useId, useRef, useState } from "react";
import { postJson } from "@/lib/api";
import { paymentLabel, fulfilmentLabel } from "@/lib/order-status";
import { parseRefundAmount } from "@/lib/refund-amount";
import { OwnerDialog } from "@/components/owner-dialog";
import { ConfirmationDialog as OwnerConfirmationDialog } from "@/components/owner-confirmation-dialog";
import type { CheckoutOrder } from "@/types/order";

const money = (paise: number) => (paise / 100).toLocaleString("en-IN", { style: "currency", currency: "INR" });
type RefundDraft = { requestId: string; expectedRefundedAmountPaise: number; maximum: number; value: string; submitted: boolean };

export function OwnerOrderActions({ order }: { order: CheckoutOrder }) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [draft, setDraft] = useState<RefundDraft | null>(null);
  const titleId = useId();
  const refunded = order.refundedAmountPaise || 0;
  const remaining = Math.max(0, (order.amountPaise || 0) - refunded);
  const refundPending = ["requested", "pending", "retry_required"].includes(order.refundStatus || "");
  const amount = draft ? parseRefundAmount(draft.value) : null;
  const validAmount = amount !== null && amount <= (draft?.maximum || 0);

  async function run(action: string) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(null); setNotice(null);
    try {
      await postJson("/api/owner/order", { orderId: order.id, action });
      setConfirm(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Order action failed."); }
    finally { locked.current = false; setBusy(false); }
  }

  function openRefund() {
    setError(null); setNotice(null);
    setDraft({ requestId: crypto.randomUUID(), expectedRefundedAmountPaise: refunded, maximum: remaining, value: ((order.refundStatus === "failed" ? Math.min(order.refundAmountPaise || remaining, remaining) : remaining) / 100).toFixed(2), submitted: false });
  }

  async function submitRefund(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !validAmount || locked.current) return;
    locked.current = true; setBusy(true); setError(null); setNotice(null);
    setDraft({ ...draft, submitted: true });
    try {
      const result = await postJson<{ order: CheckoutOrder }>("/api/owner/order", { orderId: order.id, action: "refund", amountPaise: amount, requestId: draft.requestId, expectedRefundedAmountPaise: draft.expectedRefundedAmountPaise });
      setDraft(null);
      if (result.order.refundStatus === "failed") setError("The refund failed. Check payment before reviewing and submitting a new refund.");
      else setNotice(`Refund of ${money(amount!)} submitted to the original payment method. ${paymentLabel(result.order)}.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Refund could not be confirmed. Retry this request or check payment."); }
    finally { locked.current = false; setBusy(false); }
  }

  return <div className="owner-order-payment">
    <div className="owner-order-payment-summary">
    <p className="font-semibold">{paymentLabel(order)} · {fulfilmentLabel(order)}</p>
    {order.paymentCaptured ? <p className="mt-1">Refunded: {money(refunded)} · Remaining: {money(remaining)}{refundPending ? " (another refund is being confirmed)" : ""}</p> : null}
    {order.attentionRequired ? <p className="mt-1 text-red-700">Needs attention: {order.attentionReason?.replaceAll("_", " ")}</p> : null}
    </div>
    <div className="owner-order-payment-buttons">
      <button disabled={busy} className="underline" onClick={() => void run("reconcile")}>Check payment</button>
      {order.paymentCaptured && remaining > 0 && !refundPending ? <button disabled={busy} className="underline" onClick={openRefund}>Refund</button> : null}
      {order.refundStatus === "failed" && !order.activeRefundRequestId ? <button disabled={busy} className="underline" onClick={() => setConfirm("retry-refund")}>Retry failed refund</button> : null}
      {!order.paymentCaptured && order.reservationState === "held" ? <button disabled={busy} className="underline" onClick={() => setConfirm("cancel")}>Cancel reservation</button> : null}
      {order.inventoryCommitted && !order.inventoryRestocked && order.refundStatus === "processed" ? <button disabled={busy} className="underline" onClick={() => setConfirm("restock")}>Restock inspected return</button> : null}
    </div>
    {error && !draft ? <p role="alert" className="mt-2 text-red-700">{error}</p> : null}
    {notice ? <p role="status" className="mt-2 text-[#4f5942]">{notice}</p> : null}
    <OwnerDialog open={Boolean(draft)} onClose={() => { if (!locked.current) setDraft(null); }} labelledBy={titleId}>
      {draft ? <form onSubmit={submitRefund} className="w-full max-w-md rounded-[1.7rem] border border-[#e1d5c5] bg-[#fbf4e8] p-6 text-sm text-[#3f4738] shadow-xl">
        <h3 id={titleId} className="brand-copy text-2xl">Refund payment</h3>
        <p className="mt-3 break-all">Order #{order.id}</p>
        <p className="mt-2">Already refunded: {money(draft.expectedRefundedAmountPaise)}. Available: {money(draft.maximum)}.</p>
        <label className="mt-5 block font-semibold">Refund amount (₹)
          <input name="refundAmount" type="text" inputMode="decimal" autoComplete="off" required readOnly={draft.submitted} disabled={busy} value={draft.value} onChange={event => setDraft({ ...draft, value: event.target.value })} className="mt-2 block w-full rounded-xl border border-[#d1c3ae] bg-white p-3 text-base" aria-describedby={`${titleId}-help`} />
        </label>
        <p id={`${titleId}-help`} className="mt-3 leading-6">Enter up to {money(draft.maximum)}. Razorpay returns this amount to the original payment method. Stock is restored separately after return inspection.</p>
        {!validAmount ? <p role="alert" className="mt-2 text-red-700">Enter an amount greater than zero, within the available balance, with at most two decimal places.</p> : null}
        {draft.submitted && !busy ? <p className="mt-2">Retry uses the same refund reference and amount. Check payment before starting a different refund.</p> : null}
        {error ? <p role="alert" className="mt-3 text-red-700">{error}</p> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="submit" disabled={busy || !validAmount} className="rounded-xl bg-[#8a4d43] px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Processing…" : draft.submitted ? "Retry same refund" : `Refund ${money(amount || 0)}`}</button>
          <button type="button" disabled={busy} onClick={() => setDraft(null)} className="rounded-xl border border-[#d1c3ae] px-5 py-3">Close</button>
        </div>
      </form> : null}
    </OwnerDialog>
    <OwnerConfirmationDialog open={Boolean(confirm)} title={confirm === "retry-refund" ? "Retry the failed refund?" : confirm === "restock" ? "Return these units to stock?" : "Cancel this reservation?"} pending={busy} message={confirm === "retry-refund" ? "The previous refund is confirmed failed. This starts a new protected refund attempt to the original payment method." : confirm === "restock" ? "Confirm that every unit in this order has physically returned and is fit to sell. This can be done only once." : "Payment will be checked before any held stock is released."} confirmLabel={busy ? "Processing…" : "Confirm"} onConfirm={() => void run(confirm!)} onClose={() => { if (!busy) setConfirm(null); }} />
  </div>;
}
