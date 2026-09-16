"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { createCustomerMessage } from "@/lib/customer-messages";

export function MobileContactButton({ label = "Contact us", className }: { label?: string; className?: string }) {
  const pathname = usePathname();
  const [contactOpen, setContactOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    setContactOpen(false);
  }, [pathname]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !phone.trim() || !message.trim()) {
      setError("Email, phone, and message are required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await createCustomerMessage({
        email,
        phone,
        message,
        sourcePath: pathname || "/app/"
      });
      setEmail("");
      setPhone("");
      setMessage("");
      setNotice("Your message has been sent.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Sending message failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!contactOpen) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => {
      document.body.style.overflow = overflow;
      triggerRef.current?.focus();
    };
  }, [contactOpen]);

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setContactOpen(false);
    }
    if (event.key === "Tab") {
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input, textarea, a[href]");
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }
  return <>
    <button ref={triggerRef} type="button" className={className} aria-haspopup="dialog" onClick={() => setContactOpen(true)}>{label}</button>
      {contactOpen ? createPortal(
        <div
          className="mobile-app fixed inset-0 z-[90] bg-[rgba(36,49,36,0.3)] backdrop-blur-sm"
          onClick={() => setContactOpen(false)}
        >
          <div className="mobile-app-sheet-position absolute inset-x-0 bottom-0">
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Contact us"
              onKeyDown={handleDialogKeyDown}
              className="mobile-app-sheet mobile-app-contact-sheet mx-auto max-w-[440px] px-5 pt-3"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto h-1.5 w-16 rounded-full bg-[#d8ccb8]" />
              <div className="mt-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.74rem] font-semibold uppercase tracking-[0.22em] text-[#7d876f]">Contact</p>
                  <p className="mt-2 text-[0.92rem] text-[#68735e]">Send a message without leaving the app.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setContactOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f3eee3] text-[#5e684f]"
                  aria-label="Close contact form"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>

              <form className="mt-5 space-y-3" onSubmit={(event) => void handleSubmit(event)}>
                <label className="block">
                  <span className="mb-2 block text-[0.8rem] font-medium text-[#4f5942]">Email</span>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    placeholder="you@example.com"
                    className="h-12 w-full rounded-[1rem] border border-[#ddd1c0] bg-[#fbf7ef] px-4 text-[16px] text-[#2b2a29] outline-none focus:border-[#5e684f]"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[0.8rem] font-medium text-[#4f5942]">Phone</span>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    type="tel"
                    placeholder="+91 98765 43210"
                    className="h-12 w-full rounded-[1rem] border border-[#ddd1c0] bg-[#fbf7ef] px-4 text-[16px] text-[#2b2a29] outline-none focus:border-[#5e684f]"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[0.8rem] font-medium text-[#4f5942]">Message</span>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={4}
                    placeholder="Tell us what you need help with."
                    className="w-full rounded-[1rem] border border-[#ddd1c0] bg-[#fbf7ef] px-4 py-3 text-[16px] leading-[1.45] text-[#2b2a29] outline-none focus:border-[#5e684f]"
                  />
                </label>

                {error ? <p role="alert" className="text-[0.86rem] text-[#9d4b45]">{error}</p> : null}
                {notice ? <p role="status" className="text-[0.86rem] text-[#4d6a41]">{notice}</p> : null}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="brand-caption rounded-[1rem] bg-[#5e684f] px-4 py-3.5 text-[0.64rem] font-semibold tracking-[0.14em] text-[#fbf4e8] disabled:opacity-55"
                  >
                    {submitting ? "SENDING" : "SEND MESSAGE"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactOpen(false)}
                    className="brand-caption rounded-[1rem] border border-[#d7ccb9] px-4 py-3.5 text-[0.64rem] font-semibold tracking-[0.14em] text-[#56624d]"
                  >
                    CLOSE
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      , document.body) : null}
  </>;
}
