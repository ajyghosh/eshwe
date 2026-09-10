"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";

import { signOutCurrentUser, subscribeToAuth } from "@/lib/auth";
import { sendCustomerOtp, verifyCustomerOtp } from "@/lib/customer-auth";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (options?: { autoSend?: boolean; phone?: string }) => Promise<User>;
  signOut: () => Promise<void>;
};

type PendingSignInState = {
  autoSend: boolean;
  phone: string;
  promise: Promise<User>;
  reject: (error: Error) => void;
  resolve: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizePhoneInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const pendingSignInRef = useRef<PendingSignInState | null>(null);

  useEffect(() => {
    return subscribeToAuth((nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  function signIn(options?: { autoSend?: boolean; phone?: string }) {
    if (user) {
      return Promise.resolve(user);
    }

    setDialogOpen(true);

    if (pendingSignInRef.current) {
      return pendingSignInRef.current.promise;
    }

    let resolvePromise: (user: User) => void = () => undefined;
    let rejectPromise: (error: Error) => void = () => undefined;
    const promise = new Promise<User>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    pendingSignInRef.current = {
      autoSend: Boolean(options?.autoSend),
      phone: options?.phone?.trim() ?? "",
      promise,
      reject: rejectPromise,
      resolve: resolvePromise
    };

    return promise;
  }

  function settleSignIn(userToResolve: User) {
    pendingSignInRef.current?.resolve(userToResolve);
    pendingSignInRef.current = null;
    setDialogOpen(false);
  }

  function cancelSignIn(message = "Sign in cancelled.") {
    pendingSignInRef.current?.reject(new Error(message));
    pendingSignInRef.current = null;
    setDialogOpen(false);
  }

  const value: AuthContextValue = {
    user,
    loading,
    signIn,
    signOut: signOutCurrentUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <CustomerOtpDialog
        autoSend={pendingSignInRef.current?.autoSend ?? false}
        initialPhone={pendingSignInRef.current?.phone ?? ""}
        open={dialogOpen}
        onAuthenticated={settleSignIn}
        onClose={() => cancelSignIn()}
      />
    </AuthContext.Provider>
  );
}

export function useAuthSession() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuthSession must be used within AuthProvider.");
  }

  return context;
}

function CustomerOtpDialog({
  autoSend,
  initialPhone,
  open,
  onAuthenticated,
  onClose
}: {
  autoSend: boolean;
  initialPhone: string;
  open: boolean;
  onAuthenticated: (user: User) => void;
  onClose: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const autoSendTriggeredRef = useRef(false);

  useEffect(() => {
    if (open) {
      setPhone(initialPhone);
      setOtp("");
      setStep("phone");
      setSending(false);
      setVerifying(false);
      setMessage(null);
      setError(null);
      setCooldownSeconds(0);
      autoSendTriggeredRef.current = false;
      return;
    }

    if (!open) {
      setPhone("");
      setOtp("");
      setStep("phone");
      setSending(false);
      setVerifying(false);
      setMessage(null);
      setError(null);
      setCooldownSeconds(0);
      autoSendTriggeredRef.current = false;
    }
  }, [initialPhone, open]);

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || cooldownSeconds <= 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCooldownSeconds((currentSeconds) => Math.max(0, currentSeconds - 1));
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [cooldownSeconds, open]);

  const sendOtpForPhone = useCallback(async (nextPhone: string) => {
    const normalizedPhone = normalizePhoneInput(nextPhone);

    if (normalizedPhone.length !== 10) {
      setError("Enter your 10-digit mobile number.");
      return;
    }

    setSending(true);
    setError(null);
    setMessage(null);

    try {
      const response = await sendCustomerOtp(normalizedPhone);
      setPhone(normalizedPhone);
      setStep("otp");
      setOtp("");
      setCooldownSeconds(response.cooldownSeconds ?? 0);
      setMessage(response.cooldownSeconds ? null : "Code sent.");
    } catch (nextError) {
      const nextMessage = nextError instanceof Error ? nextError.message : "Verification SMS could not be sent.";
      const retryAfterSeconds = readRetryAfterSeconds(nextMessage);

      if (retryAfterSeconds > 0) {
        setPhone(normalizedPhone);
        setStep("otp");
        setOtp("");
        setCooldownSeconds(retryAfterSeconds);
        setError(null);
        setMessage(null);
        return;
      }

      setError(nextMessage);
    } finally {
      setSending(false);
    }
  }, []);

  async function handleSendOtp() {
    await sendOtpForPhone(phone);
  }

  async function handleVerifyOtp() {
    if (!otp.trim()) {
      setError("Enter the code sent to your phone.");
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      const signedInUser = await verifyCustomerOtp(phone, otp);
      onAuthenticated(signedInUser);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Code verification failed.");
    } finally {
      setVerifying(false);
    }
  }

  const signedInLabel = phone.trim() || "your mobile number";
  useEffect(() => {
    if (!open || !autoSend || autoSendTriggeredRef.current) {
      return;
    }

    const normalizedPhone = initialPhone.replace(/\D/g, "").slice(0, 10);

    if (normalizedPhone.length !== 10) {
      return;
    }

    autoSendTriggeredRef.current = true;
    setPhone(normalizedPhone);
    setStep("otp");
    void sendOtpForPhone(normalizedPhone);
  }, [autoSend, initialPhone, open, sendOtpForPhone]);

  if (!open) {
    return null;
  }

  return (
    <div className="customer-otp-overlay fixed inset-0 z-[90] flex items-end justify-center bg-[#354233]/36 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-6 sm:items-center sm:px-4 sm:py-6">
      <div className="customer-otp-panel max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-[1.9rem] border border-[#ddd1c0] bg-[#fbf4e8] p-5 shadow-[0_24px_60px_rgba(47,52,45,0.2)] sm:rounded-[2rem] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#7d876f]">Sign in</p>
            <h2 className="brand-copy mt-3 text-[1.75rem] leading-tight text-[#2f342d] sm:text-[2rem]">Verify mobile</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#d7ccb9] px-4 py-2 text-[0.62rem] font-semibold tracking-[0.14em] text-[#56624d]"
          >
            CLOSE
          </button>
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-[#e7dccd] bg-white/72 p-4">
          {step === "phone" ? (
            <>
              <label className="block">
                <span className="mb-2 block text-[0.82rem] font-medium text-[#4f5942]">10-digit phone number</span>
                <input
                  value={phone}
                  onChange={(event) => setPhone(normalizePhoneInput(event.target.value))}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="9876543210"
                  className="h-12 w-full rounded-[1rem] border border-[#d9ccb8] bg-white px-4 text-[16px] text-[#2b2a29] outline-none transition-colors duration-200 placeholder:text-[#948978] focus:border-[#5e684f]"
                />
              </label>
              <button
                type="button"
                onClick={() => void handleSendOtp()}
                disabled={sending}
                className="brand-caption mt-5 inline-flex h-11 w-full items-center justify-center rounded-[1rem] bg-[#5e684f] px-4 text-[0.62rem] font-semibold tracking-[0.14em] text-[#fbf4e8] disabled:opacity-60"
              >
                {sending ? "SENDING..." : "PROCEED"}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 rounded-[1rem] border border-[#e2d6c5] bg-[#fffaf2] px-4 py-3">
                <p className="min-w-0 truncate text-[0.95rem] font-medium text-[#2b2a29]">{signedInLabel}</p>
                <button
                  type="button"
                  onClick={() => {
                    setStep("phone");
                    setOtp("");
                    setError(null);
                    setMessage(null);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d7ccb9] text-[#56624d]"
                  aria-label="Edit phone number"
                >
                  <PencilIcon />
                </button>
              </div>

              <label className="mt-4 block">
                <span className="mb-2 block text-[0.82rem] font-medium text-[#4f5942]">OTP</span>
                <input
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  className="h-12 w-full rounded-[1rem] border border-[#d9ccb8] bg-white px-4 text-[16px] tracking-[0.25em] text-[#2b2a29] outline-none transition-colors duration-200 placeholder:tracking-normal placeholder:text-[#948978] focus:border-[#5e684f]"
                />
              </label>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => void handleSendOtp()}
                  disabled={sending || cooldownSeconds > 0}
                  className="inline-flex items-center justify-center rounded-[1rem] border border-[#d7ccb9] px-4 py-3 text-[0.62rem] font-semibold tracking-[0.14em] text-[#56624d] disabled:opacity-60"
                >
                  {sending ? "SENDING OTP..." : cooldownSeconds > 0 ? `RESEND IN ${cooldownSeconds}s` : "RESEND"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleVerifyOtp()}
                  disabled={verifying}
                  className="brand-caption inline-flex items-center justify-center rounded-[1rem] bg-[#5e684f] px-4 py-3 text-[0.62rem] font-semibold tracking-[0.14em] text-[#fbf4e8] disabled:opacity-60"
                >
                  {verifying ? "VERIFYING..." : "VERIFY"}
                </button>
              </div>
            </>
          )}

          {message ? <p className="mt-3 text-[0.8rem] text-[#5e684f]">{message}</p> : null}
          {error ? <p className="mt-3 text-[0.8rem] text-[#a8574d]">{error}</p> : null}
        </div>

      </div>
    </div>
  );
}

function readRetryAfterSeconds(message: string) {
  const match = message.match(/try again in\s+(\d+)\s+seconds?/i);

  if (!match) {
    return 0;
  }

  const parsedSeconds = Number.parseInt(match[1] ?? "0", 10);
  return Number.isFinite(parsedSeconds) && parsedSeconds > 0 ? parsedSeconds : 0;
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M12 20h9" />
      <path d="m16.5 3.5 4 4L8 20l-5 1 1-5L16.5 3.5Z" />
    </svg>
  );
}
