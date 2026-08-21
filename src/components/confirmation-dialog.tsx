"use client";

type ConfirmationDialogProps = {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "neutral";
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmationDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  pending = false,
  onConfirm,
  onClose
}: ConfirmationDialogProps) {
  if (!open) {
    return null;
  }

  const confirmClassName =
    tone === "danger"
      ? "bg-[#8a4d43] text-[#fbf4e8]"
      : "bg-[#5e684f] text-[#fbf4e8]";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#3f4738]/38 px-4 py-6 sm:px-6">
      <div className="w-full max-w-md rounded-[1.7rem] border border-[#e1d5c5] bg-[#fbf4e8] p-6 shadow-[0_28px_70px_rgba(63,71,56,0.2)] sm:p-7">
        <h3 className="brand-copy text-2xl text-[#3f4738]">{title}</h3>
        {message ? <p className="mt-3 text-sm leading-7 text-[#667056]">{message}</p> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`brand-caption rounded-2xl px-5 py-3 text-[0.62rem] font-semibold tracking-[0.08em] disabled:opacity-60 ${confirmClassName}`}
          >
            {pending ? "PLEASE WAIT..." : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="brand-caption rounded-2xl border border-[#d1c3ae] px-5 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#5e684f] disabled:opacity-60"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
