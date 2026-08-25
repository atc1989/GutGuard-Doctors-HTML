import { LOCAL_KEY, PARTNER_PENDING_SIGNIN_KEY, PARTNER_PENDING_WELCOME_KEY } from "@/lib/constants";
import type { ExperienceState } from "@/lib/types";

export type PendingPartnerSignin = {
  email: string;
  otpSent: boolean;
  doctorId?: string;
};

export type PendingPartnerWelcome = {
  email: string;
  doctorId: string;
};

const PENDING_SIGNIN_MAX_AGE_MS = 10 * 60 * 1000;
const PENDING_WELCOME_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export const INITIAL_STATE: ExperienceState = {
  registration: null,
  tasks: { email: false, facebook: false, tiktok: false, reel: false },
  spun: false,
  prize: null,
  prizeNote: null,
};

export function loadExperienceState(): ExperienceState {
  if (typeof window === "undefined") return INITIAL_STATE;

  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return INITIAL_STATE;
    return { ...INITIAL_STATE, ...JSON.parse(raw) };
  } catch {
    return INITIAL_STATE;
  }
}

export function saveExperienceState(state: ExperienceState) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  } catch {
    // Local persistence is best-effort for booth devices with restricted storage.
  }
}

export function clearExperienceState() {
  try {
    window.localStorage.removeItem(LOCAL_KEY);
  } catch {
    // Local persistence is best-effort for booth devices with restricted storage.
  }
}

export function stashPendingPartnerSignin(pending: PendingPartnerSignin) {
  try {
    window.sessionStorage.setItem(
      PARTNER_PENDING_SIGNIN_KEY,
      JSON.stringify({ ...pending, at: Date.now() }),
    );
  } catch {
    // sessionStorage is best-effort on restricted browsers.
  }
}

export function takePendingPartnerSignin(): PendingPartnerSignin | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(PARTNER_PENDING_SIGNIN_KEY);
    window.sessionStorage.removeItem(PARTNER_PENDING_SIGNIN_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { email?: unknown; otpSent?: unknown; doctorId?: unknown; at?: unknown };
    const email = typeof parsed.email === "string" ? parsed.email.trim().toLowerCase() : "";
    const at = typeof parsed.at === "number" ? parsed.at : 0;
    if (!email || !at || Date.now() - at > PENDING_SIGNIN_MAX_AGE_MS) return null;

    const doctorId = typeof parsed.doctorId === "string" ? parsed.doctorId.trim() : "";
    return { email, otpSent: parsed.otpSent === true, doctorId: doctorId || undefined };
  } catch {
    return null;
  }
}

export function stashPendingPartnerWelcome(pending: PendingPartnerWelcome) {
  if (!pending.doctorId || pending.doctorId.startsWith("local-")) return;
  try {
    window.localStorage.setItem(
      PARTNER_PENDING_WELCOME_KEY,
      JSON.stringify({ ...pending, email: pending.email.trim().toLowerCase(), at: Date.now() }),
    );
  } catch {
    // localStorage is best-effort on restricted browsers.
  }
}

export function peekPendingPartnerWelcome(email: string): string | null {
  if (typeof window === "undefined") return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  try {
    const raw = window.localStorage.getItem(PARTNER_PENDING_WELCOME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: unknown; doctorId?: unknown; at?: unknown };
    const storedEmail = typeof parsed.email === "string" ? parsed.email.trim().toLowerCase() : "";
    const doctorId = typeof parsed.doctorId === "string" ? parsed.doctorId.trim() : "";
    const at = typeof parsed.at === "number" ? parsed.at : 0;
    if (!storedEmail || storedEmail !== normalized || !doctorId || doctorId.startsWith("local-")) return null;
    if (!at || Date.now() - at > PENDING_WELCOME_MAX_AGE_MS) {
      window.localStorage.removeItem(PARTNER_PENDING_WELCOME_KEY);
      return null;
    }
    return doctorId;
  } catch {
    return null;
  }
}

export function clearPendingPartnerWelcome() {
  try {
    window.localStorage.removeItem(PARTNER_PENDING_WELCOME_KEY);
  } catch {
    // localStorage is best-effort on restricted browsers.
  }
}
