"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useAuthSession } from "@/components/auth-provider";
import { getCustomerProfile } from "@/lib/customer-profiles";
import { buildProductDetailPath } from "@/lib/storefront-routes";
import { createWaitlistEntry } from "@/lib/waitlist";
import type { Saree } from "@/types/saree";

type NotifyWaitlistDialogProps = {
  open: boolean;
  product: Saree | null;
  onClose: () => void;
};

export function NotifyWaitlistDialog({
  open,
  product,
  onClose
}: NotifyWaitlistDialogProps) {
  const { user } = useAuthSession();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    return () => {
      setMounted(false);
    };
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setNotice(null);
      setEmail("");
      setPhone("");
      onClose();
    }, 1600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [notice, onClose]);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setPhone("");
      setSubmitting(false);
      setError(null);
      setNotice(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !user) {
      return;
    }

    const currentUser = user;
    let cancelled = false;

    async function preloadSignedInContact() {
      try {
        const customerProfile = await getCustomerProfile(currentUser.uid).catch(() => null);
        const resolvedEmail = customerProfile?.email?.trim() || currentUser.email?.trim() || "";
        const resolvedPhone = customerProfile?.phone?.trim() || "";

        if (cancelled) {
          return;
        }

        setEmail((current) => current || resolvedEmail);
        setPhone((current) => current || resolvedPhone);
      } catch {
        if (cancelled) {
          return;
        }
      }
    }

    void preloadSignedInContact();

    return () => {
      cancelled = true;
    };
  }, [open, user]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!product) {
      setError("Product details are unavailable right now.");
      return;
    }

    if (!email.trim() && !phone.trim()) {
      setError("Enter an email address or phone number.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await createWaitlistEntry({
        productId: product.id ?? product.sku,
        productName: product.name,
        productSlug: product.slug,
        productSku: product.sku,
        productCategory: product.category,
        email,
        phone,
        sourcePath: resolveWaitlistSourcePath(product)
      });
      setNotice("We saved your request and will let you know when this saree is back.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Saving waitlist request failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || !product || !mounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#3f4738]/36 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl rounded-[2rem] border border-[#dfd2c1] bg-[#fbf4e8] p-6 shadow-[0_30px_90px_rgba(63,71,56,0.22)] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="brand-caption text-[0.58rem] font-semibold tracking-[0.18em] text-[#7d876f]">
              NOTIFY ME
            </p>
            <h2 className="brand-copy mt-3 text-2xl text-[#3f4738] sm:text-[2rem]">
              Get an update when {product.name} is back in stock.
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#667056]">
              Leave your email address, phone number, or both and the boutique can follow up.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="brand-caption rounded-full border border-[#d6ccb9] px-4 py-2 text-[0.52rem] font-semibold tracking-[0.08em] text-[#5e684f]"
          >
            CLOSE
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#4f5942]">Email</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                className={inputClassName}
                placeholder="you@example.com"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#4f5942]">Phone Number</span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                type="tel"
                className={inputClassName}
                placeholder="+91 98765 43210"
              />
            </label>
          </div>

          {error ? <p className="text-sm text-[#9d4b45]">{error}</p> : null}
          {notice ? <p className="text-sm text-[#4d6a41]">{notice}</p> : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="brand-caption rounded-2xl bg-[#5e684f] px-5 py-3 text-[0.62rem] font-semibold tracking-[0.08em] text-[#fbf4e8] disabled:opacity-60"
            >
              {submitting ? "SAVING..." : "NOTIFY"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function resolveWaitlistSourcePath(product: Saree) {
  return buildProductDetailPath(product.slug);
}

const inputClassName =
  "h-[52px] w-full rounded-[1rem] border border-[#d9ccb8] bg-white/70 px-4 text-sm text-[#3f4738] outline-none transition-colors duration-200 placeholder:text-[#948978] focus:border-[#5e684f]";
