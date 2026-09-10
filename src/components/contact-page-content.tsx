"use client";

import { useState } from "react";

import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { createCustomerMessage } from "@/lib/customer-messages";

const inputClassName =
  "h-[54px] w-full rounded-[1rem] border border-[#d9ccb8] bg-white/72 px-4 text-sm text-[#3f4738] outline-none transition-colors duration-200 placeholder:text-[#948978] focus:border-[#5e684f]";

export function ContactPageContent() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
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
        sourcePath: "/contact"
      });
      setEmail("");
      setPhone("");
      setMessage("");
      setNotice("Your message has been sent. We will get back to you soon.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Sending message failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="web-storefront min-h-screen bg-[#fbf4e8] text-[#4f5942]">
      <StorefrontHeader />

      <section className="px-6 py-14 sm:px-10 sm:py-16 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[2rem] border border-[#e3d8c9] bg-[#f8f0e3] p-8 shadow-[0_24px_60px_rgba(94,104,79,0.08)] sm:p-10">
            <p className="brand-caption text-[0.62rem] font-semibold tracking-[0.18em] text-[#7d876f]">
              CONTACT
            </p>
            <h1 className="brand-copy mt-4 text-3xl leading-[1.08] text-[#3f4738] sm:text-[3.1rem]">
              Boutique support for product queries, gifting, and occasion styling.
            </h1>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-[#667056] sm:text-[0.98rem]">
              Send your question here and it will appear in the owner messages screen for follow-up.
            </p>

            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
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

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#4f5942]">Message</span>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={6}
                  className={`${inputClassName} h-auto resize-none py-3`}
                  placeholder="Tell us what you need help with."
                />
              </label>

              {error ? <p className="text-sm text-[#9d4b45]">{error}</p> : null}
              {notice ? <p className="text-sm text-[#4d6a41]">{notice}</p> : null}

              <button
                type="submit"
                disabled={submitting}
                className="brand-caption inline-flex items-center justify-center rounded-full bg-[#5e684f] px-6 py-3 text-[0.64rem] font-semibold tracking-[0.12em] text-[#fbf4e8] disabled:opacity-60"
              >
                {submitting ? "SENDING..." : "SEND MESSAGE"}
              </button>
            </form>
          </div>
        </div>
      </section>

      <SiteFooter homeHref="/" contactId="contact" />
    </main>
  );
}
