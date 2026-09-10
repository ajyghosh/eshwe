"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function OwnerDialog({
  open,
  onClose,
  labelledBy,
  children,
  className = ""
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const returnFocus = open && document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return () => {
      if (dialog.open) dialog.close();
      // A discard confirmation can close both nested dialogs in one render.
      // Restore focus after both have unmounted, skipping detached form controls.
      queueMicrotask(() => {
        if (!returnFocus?.isConnected) return;
        const dialogs = document.querySelectorAll("dialog[open]");
        const activeDialog = dialogs[dialogs.length - 1];
        if (!activeDialog || activeDialog.contains(returnFocus)) returnFocus.focus();
      });
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      className={`owner-dialog ${className}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {children}
    </dialog>
  );
}
