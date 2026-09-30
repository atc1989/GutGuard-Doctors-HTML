"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Logo } from "@/components/GutguardSite";
import PartnerApplyForm from "@/components/PartnerApplyForm";
import PartnerShell from "@/components/partner/PartnerShell";
import { PartnerProvider } from "@/components/partner/shared";
import {
  enrollWelcomeIfNeeded,
  getPartnerAuthEmail,
  getPartnerDashboard,
  getPartnerInvitation,
  hasPartnerSession,
  sendPartnerOtp,
  signOutPartner,
  verifyPartnerOtp,
  type PartnerDashboard,
} from "@/lib/api";
import { PARTNER_REFERRER_KEY } from "@/lib/constants";
import {
  clearPendingPartnerWelcome,
  peekPendingPartnerWelcome,
  stashPendingPartnerSignin,
  stashPendingPartnerWelcome,
  takePendingPartnerSignin,
  saveOtpSentAt,
  loadOtpSentAt,
  clearOtpSentAt,
} from "@/lib/storage";

type View = "checking" | "email" | "apply" | "code" | "signing-in" | "dashboard";
type AuthError = { field: "email" | "code" | "form"; message: string; expired?: boolean } | null;
type PartnerPortalProps = {
  initialView?: "email" | "apply";
  referrerSlug?: string;
  /** Rendered inside the dashboard shell once signed in. Omit on public pages such as registration. */
  children?: React.ReactNode;
};

const RESEND_COOLDOWN_SECONDS = 60;

export default function PartnerPortal({ initialView: initialViewProp, referrerSlug: referrerSlugProp, children }: PartnerPortalProps) {
  const searchParams = useSearchParams();
  const firstQuery = (key: string) => searchParams.get(key)?.trim() ?? "";
  const initialView = initialViewProp ?? (["1", "true", "yes"].includes(firstQuery("apply").toLowerCase()) ? "apply" : "email");
  const referrerSlug = referrerSlugProp ?? firstQuery("ref").toLowerCase();
  const [view, setView] = useState<View>("checking");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<AuthError>(null);
  const [busyAction, setBusyAction] = useState<"send" | "verify" | "resend" | null>(null);
  const [resendRemaining, setResendRemaining] = useState(0);
  const [notice, setNotice] = useState("");
  const [data, setData] = useState<PartnerDashboard | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const codeHeadingRef = useRef<HTMLHeadingElement>(null);
  const requestPendingRef = useRef(false);
  const initialViewRef = useRef(initialView);
  const pendingWelcomeDoctorIdRef = useRef<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [invitation, setInvitation] = useState<{ slug: string; fullName: string } | null>(null);

  const load = useCallback(async () => {
    const dashboard = await getPartnerDashboard();
    setData(dashboard);
    setView("dashboard");
    if (typeof window !== "undefined" && window.location.pathname === "/partner" && window.location.search) {
      window.history.replaceState(null, "", "/partner");
    }
  }, []);

  const deliverWelcomeAfterSignIn = useCallback((signedInEmail: string) => {
    const doctorId =
      pendingWelcomeDoctorIdRef.current || peekPendingPartnerWelcome(signedInEmail);
    if (!doctorId) return;
    pendingWelcomeDoctorIdRef.current = null;
    void enrollWelcomeIfNeeded(doctorId)
      .then(() => {
        clearPendingPartnerWelcome();
      })
      .catch(() => {
        pendingWelcomeDoctorIdRef.current = doctorId;
      });
  }, []);

  useEffect(() => {
    let cancelled = false;

    hasPartnerSession()
      .then(async (signedIn) => {
        if (cancelled) return;
        if (!signedIn) {
          const pending = takePendingPartnerSignin();
          if (pending) {
            setEmail(pending.email);
            if (pending.doctorId) pendingWelcomeDoctorIdRef.current = pending.doctorId;
            if (pending.otpSent) {
              setView("code");
              setNotice("Account created. Check your email for a sign-in code.");
              setResendRemaining(RESEND_COOLDOWN_SECONDS);
              return;
            }
            setError({
              field: "form",
              message: "Your account was created, but we couldn’t email a sign-in code. Request a code to open your dashboard.",
            });
            setView("email");
            return;
          }
          setView(initialViewRef.current === "apply" ? "apply" : "email");
          return;
        }
        // A live session is not the same as being a partner: the account may exist while the
        // address is not on any registration. Let the failure land on the login screen.
        try {
          await load();
          const signedInEmail = await getPartnerAuthEmail();
          if (!cancelled && signedInEmail) deliverWelcomeAfterSignIn(signedInEmail);
        } catch {
          if (cancelled) return;
          await signOutPartner();
          setError({ field: "form", message: "Your dashboard could not be loaded. Please sign in again." });
          setView("email");
        }
      })
      .catch(() => {
        if (!cancelled) setView(initialViewRef.current === "apply" ? "apply" : "email");
      });

    return () => {
      cancelled = true;
    };
  }, [load, deliverWelcomeAfterSignIn]);

  useEffect(() => {
    const fromQuery = referrerSlug.trim().toLowerCase();
    const stored = typeof window === "undefined" ? "" : window.sessionStorage.getItem(PARTNER_REFERRER_KEY) ?? "";
    const slug = fromQuery || stored;
    if (!slug) return;

    let cancelled = false;
    getPartnerInvitation(slug)
      .then((invite) => {
        if (cancelled || !invite) return;
        window.sessionStorage.setItem(PARTNER_REFERRER_KEY, invite.routing_slug);
        setInvitation({ slug: invite.routing_slug, fullName: invite.full_name });
      })
      .catch(() => {
        // Invalid or unreachable slug: register with no referrer rather than blocking the form.
      });

    return () => {
      cancelled = true;
    };
  }, [referrerSlug]);

  useEffect(() => {
    if (resendRemaining <= 0) return;
    const timer = window.setInterval(() => {
      setResendRemaining((remaining) => Math.max(0, remaining - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendRemaining]);

  // Restore the resend cooldown from sessionStorage so a page reload cannot
  // reset the counter to zero and let the user bypass the 60-second wait.
  useEffect(() => {
    if (!email) return;
    const sentAt = loadOtpSentAt(email);
    if (!sentAt) return;
    const elapsed = Math.floor((Date.now() - sentAt) / 1000);
    const remaining = Math.max(0, RESEND_COOLDOWN_SECONDS - elapsed);
    if (remaining > 0) setResendRemaining(remaining);
  }, [email]);

  useEffect(() => {
    if (view !== "code") return;
    requestAnimationFrame(() => {
      codeHeadingRef.current?.focus();
      codeInputRef.current?.focus();
    });
  }, [view]);

  function validateEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function validateEmailField() {
    const normalized = email.trim();
    if (!normalized || !validateEmail(normalized)) {
      setError({ field: "email", message: "Enter a valid email address." });
      return false;
    }
    if (error?.field === "email") setError(null);
    return true;
  }

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    if (requestPendingRef.current || busyAction || !validateEmailField()) return;
    requestPendingRef.current = true;
    const normalizedEmail = email.trim().toLowerCase();
    setEmail(normalizedEmail);
    setBusyAction("send");
    setError(null);
    setNotice("Sending code…");

    try {
      await sendPartnerOtp(normalizedEmail);
      setCode("");
      setResendRemaining(RESEND_COOLDOWN_SECONDS);
      saveOtpSentAt(normalizedEmail);
      setView("code");
      setNotice("Code sent. Check your email.");
    } catch (caught) {
      setError(getSendError(caught));
      setNotice("");
    } finally {
      requestPendingRef.current = false;
      setBusyAction(null);
    }
  }

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    if (requestPendingRef.current || busyAction) return;
    if (code.length !== 6) {
      setError({ field: "code", message: "Enter the complete 6-digit code." });
      codeInputRef.current?.focus();
      return;
    }
    requestPendingRef.current = true;
    setBusyAction("verify");
    setError(null);
    setNotice("Verifying code…");

    try {
      await verifyPartnerOtp(email, code);
      void deliverWelcomeAfterSignIn(email);
    } catch (caught) {
      const nextError = getVerificationError(caught);
      setError(nextError);
      if (nextError.expired) setResendRemaining(0);
      setView("code");
      setNotice("");
      requestAnimationFrame(() => codeInputRef.current?.focus());
      requestPendingRef.current = false;
      setBusyAction(null);
      return;
    }

    try {
      setView("signing-in");
      setNotice("Signing you in…");
      await load();
    } catch {
      await signOutPartner();
      setError({
        field: "form",
        message: "You signed in, but the partner dashboard could not load. Sign in again in a moment.",
      });
      setView("email");
      setNotice("");
    } finally {
      requestPendingRef.current = false;
      setBusyAction(null);
    }
  }

  async function resendCode() {
    if (requestPendingRef.current || busyAction || resendRemaining > 0) return;
    requestPendingRef.current = true;
    setBusyAction("resend");
    setError(null);
    setNotice("Sending a new code…");
    try {
      await sendPartnerOtp(email);
      setCode("");
      setResendRemaining(RESEND_COOLDOWN_SECONDS);
      saveOtpSentAt(email);
      setNotice("A new code was sent.");
      requestAnimationFrame(() => codeInputRef.current?.focus());
    } catch (caught) {
      setError(getResendError(caught));
      setNotice("");
    } finally {
      requestPendingRef.current = false;
      setBusyAction(null);
    }
  }

  function changeEmail() {
    clearOtpSentAt();
    setView("email");
    setCode("");
    setError(null);
    setNotice("");
    setResendRemaining(0);
    requestAnimationFrame(() => {
      emailInputRef.current?.focus();
      emailInputRef.current?.select();
    });
  }

  function showApply() {
    setView("apply");
    setCode("");
    setError(null);
    setNotice("");
    setResendRemaining(0);
    router.replace(pathname === "/partner" ? "/partner?apply=1" : "/physicians/register");
  }

  function showSignIn() {
    setView("email");
    setCode("");
    setError(null);
    setNotice("");
    setResendRemaining(0);
    router.replace("/partner");
  }

  async function handleRegistered(registeredEmail: string, doctorId: string) {
    const normalizedEmail = registeredEmail.trim().toLowerCase();
    setEmail(normalizedEmail);
    setError(null);
    setView("signing-in");
    setNotice("Sending your sign-in code…");

    try {
      window.sessionStorage.removeItem(PARTNER_REFERRER_KEY);
    } catch {
      // sessionStorage is best-effort.
    }
    setInvitation(null);

    if (doctorId && !doctorId.startsWith("local-")) {
      pendingWelcomeDoctorIdRef.current = doctorId;
      stashPendingPartnerWelcome({ email: normalizedEmail, doctorId });
    }

    let otpSent = false;
    try {
      await sendPartnerOtp(normalizedEmail);
      otpSent = true;
      saveOtpSentAt(normalizedEmail);
    } catch (caught) {
      saveOtpSentAt(normalizedEmail);
      setResendRemaining(RESEND_COOLDOWN_SECONDS);
      setError(getSendError(caught));
    }

    if (pathname !== "/partner") {
      stashPendingPartnerSignin({
        email: normalizedEmail,
        otpSent,
        doctorId: pendingWelcomeDoctorIdRef.current ?? undefined,
      });
      router.replace("/partner");
      return;
    }

    if (otpSent) {
      setCode("");
      setResendRemaining(RESEND_COOLDOWN_SECONDS);
      setView("code");
      setNotice("Account created. Check your email for a sign-in code.");
      setError(null);
      if (typeof window !== "undefined" && window.location.search) {
        window.history.replaceState(null, "", "/partner");
      }
      return;
    }

    setView("email");
    setNotice("");
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState(null, "", "/partner");
    }
  }

  async function signOut() {
    await signOutPartner();
    setData(null);
    setCode("");
    setError(null);
    setNotice("");
    setView("email");
  }

  // Public pages (registration) have no dashboard shell, so a live session goes to the portal.
  const redirectToPortal = view === "dashboard" && !children;
  useEffect(() => {
    if (redirectToPortal) router.replace("/partner");
  }, [redirectToPortal, router]);

  if (view === "checking" || redirectToPortal) {
    return (
      <main className="shop-shell partner-auth-shell">
        <PartnerNav />
        <section className="partner-auth-card partner-auth-loading" aria-busy="true" aria-live="polite">
          <LoaderCircle className="partner-spinner" aria-hidden="true" />
          <p className="partner-eyebrow">Partner portal</p>
          <h1>Opening your dashboard</h1>
        </section>
      </main>
    );
  }

  if (view === "dashboard" && data) {
    return (
      <PartnerProvider value={{ dashboard: data, signOut }}>
        <PartnerShell>{children}</PartnerShell>
      </PartnerProvider>
    );
  }

  if (view === "signing-in") {
    return (
      <main className="shop-shell partner-auth-shell">
        <PartnerNav />
        <section className="partner-auth-card partner-auth-loading" aria-busy="true" aria-live="polite">
          <LoaderCircle className="partner-spinner" aria-hidden="true" />
          <p className="partner-eyebrow">Partner portal</p>
          <h1>{notice.startsWith("Sending") ? "Application received" : "Signing you in…"}</h1>
          <p>{notice || "Opening your secure partner dashboard."}</p>
        </section>
      </main>
    );
  }

  if (view === "apply") {
    return (
      <main className="shop-shell partner-auth-shell">
        <PartnerNav />
        <section className="partner-auth-card partner-apply-card" aria-labelledby="partner-apply-title">
          <p className="partner-eyebrow">Partner portal</p>
          <h1 id="partner-apply-title">Apply to become a partner</h1>
          <p className="partner-auth-lede">
            Tell us how to reach you. We’ll create your partner account and email a sign-in code so you can open your dashboard right away.
          </p>
          <PartnerApplyForm invitedBy={invitation} onRegistered={handleRegistered} onSignIn={showSignIn} />
          <p className="partner-auth-trust">
            After you submit, we email a one-time code and open your dashboard. No Facebook follow or prize wheel.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="shop-shell partner-auth-shell">
      <PartnerNav />
      <section className="partner-auth-card" aria-labelledby="partner-auth-title">
        <p className="partner-eyebrow">Partner portal</p>
        <h1 id="partner-auth-title" ref={view === "code" ? codeHeadingRef : undefined} tabIndex={view === "code" ? -1 : undefined}>
          {view === "code" ? "Check your email" : "Welcome back"}
        </h1>
        <p className="partner-auth-lede">
          {view === "code"
            ? <>We sent a 6-digit code to <strong>{maskEmail(email)}</strong>. Enter it below to continue.</>
            : <>Sign in to track your referrals, orders, and campaign activity. We’ll email a secure one-time code—no password required.</>}
        </p>

        <div className="partner-auth-status" role="status" aria-live="polite">{notice}</div>

        {view === "code" ? (
          <form className="partner-form" onSubmit={submitCode} noValidate>
            <label htmlFor="partner-code">Verification code</label>
            <input
              ref={codeInputRef}
              id="partner-code"
              name="one-time-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                if (error?.field === "code") setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              aria-describedby={error ? "partner-code-error partner-code-help" : "partner-code-help"}
              aria-invalid={error?.field === "code" || undefined}
              placeholder="000000"
              required
            />
            <p id="partner-code-help" className="partner-field-help">Enter all six digits from the email. The server enforces code expiration.</p>
            {error ? <div id="partner-code-error" className="partner-auth-error" role="alert">{error.message}</div> : null}
            <button type="submit" className="shop-primary partner-auth-primary" disabled={Boolean(busyAction) || code.length < 6}>
              {busyAction === "verify" ? <LoaderCircle className="partner-spinner" aria-hidden="true" /> : null}
              <span>{busyAction === "verify" ? "Verifying…" : "Verify and continue"}</span>
            </button>
            <div className="partner-auth-secondary-actions">
              <button type="button" className="partner-auth-text-button" onClick={resendCode} disabled={Boolean(busyAction) || resendRemaining > 0}>
                {busyAction === "resend" ? "Resending…" : resendRemaining > 0 ? `Resend code in ${formatCountdown(resendRemaining)}` : "Resend code"}
              </button>
              <button type="button" className="partner-auth-text-button" onClick={changeEmail} disabled={Boolean(busyAction)}>
                Use a different email
              </button>
            </div>
          </form>
        ) : (
          <form className="partner-form" onSubmit={requestCode} noValidate>
            <label htmlFor="partner-email">Email address</label>
            <input
              ref={emailInputRef}
              id="partner-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (error?.field === "email") setError(null);
              }}
              onBlur={validateEmailField}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              aria-describedby={error ? "partner-email-error" : undefined}
              aria-invalid={error?.field === "email" || undefined}
              placeholder="name@clinic.ph"
              required
            />
            {error ? <div id="partner-email-error" className="partner-auth-error" role="alert">{error.message}</div> : null}
            <button type="submit" className="shop-primary partner-auth-primary" disabled={Boolean(busyAction) || !email.trim()}>
              {busyAction === "send" ? <LoaderCircle className="partner-spinner" aria-hidden="true" /> : null}
              <span>{busyAction === "send" ? "Sending code…" : "Email me a sign-in code"}</span>
            </button>
            <p className="partner-apply-link">
              New to GutGuard?{" "}
              <button type="button" className="partner-auth-text-button" onClick={showApply}>
                Apply to become a partner
              </button>
            </p>
          </form>
        )}

        <p className="partner-auth-trust">Secure passwordless sign-in · Expiration and resend limits are enforced by our authentication provider</p>
      </section>
    </main>
  );
}

function PartnerNav({ onSignOut }: { onSignOut?: () => void }) {
  return (
    <nav className="shop-nav partner-auth-nav" aria-label="Partner header">
      <div className="partner-auth-brand-group">
        <Link className="shop-brand" href="/" aria-label="GutGuard home">
          <Logo h={29} />
        </Link>
        <span className="partner-auth-portal-name">Partner Portal</span>
      </div>
      {onSignOut ? (
        <button type="button" className="shop-nav-link" onClick={onSignOut}>
          Sign out
        </button>
      ) : (
        <Link className="shop-nav-link" href="/shop">
          Back to GutGuard Shop
        </Link>
      )}
    </nav>
  );
}

function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"•".repeat(Math.max(3, Math.min(5, local.length - visible.length)))}@${domain}`;
}

function formatCountdown(seconds: number) {
  return `00:${String(seconds).padStart(2, "0")}`;
}

function getVerificationError(error: unknown): NonNullable<AuthError> {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("expired") || message.includes("otp_expired")) {
    return { field: "code", message: "That code has expired. Request a new code to continue.", expired: true };
  }
  if (message.includes("rate") || message.includes("too many") || message.includes("429")) {
    return { field: "code", message: "Too many attempts. Wait a moment, then request a new code." };
  }
  return { field: "code", message: "That code isn’t correct. Check the email and try again." };
}

function getSendError(error: unknown): NonNullable<AuthError> {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("email rate limit") || message.includes("over_email_send_rate_limit")) {
    return { field: "form", message: "Too many sign-in emails were sent. Wait a few minutes and try again." };
  }
  if (
    message.includes("rate") ||
    message.includes("too many") ||
    message.includes("429") ||
    message.includes("security purposes") ||
    /after \d+ seconds/.test(message)
  ) {
    return { field: "form", message: "Too many sign-in requests. Wait a minute and try again." };
  }
  return { field: "form", message: "We couldn’t send a code. Check your connection and try again." };
}

function getResendError(error: unknown): NonNullable<AuthError> {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("email rate limit") || message.includes("over_email_send_rate_limit")) {
    return { field: "code", message: "Too many sign-in emails were sent. Wait a few minutes and try again." };
  }
  if (
    message.includes("rate") ||
    message.includes("too many") ||
    message.includes("429") ||
    message.includes("security purposes") ||
    /after \d+ seconds/.test(message)
  ) {
    return { field: "code", message: "A new code can’t be sent yet. Wait a minute and try again." };
  }
  return { field: "code", message: "We couldn’t resend the code. Check your connection and try again." };
}
