import { LOCAL_KEY, PARTNER_PENDING_SIGNIN_KEY } from "@/lib/constants";
import type { ExperienceState } from "@/lib/types";

export type PendingPartnerSignin = {
  email: string;
  otpSent: boolean;
};

const PENDING_SIGNIN_MAX_AGE_MS = 10 * 60 * 1000;

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

    const parsed = JSON.parse(raw) as { email?: unknown; otpSent?: unknown; at?: unknown };
    const email = typeof parsed.email === "string" ? parsed.email.trim().toLowerCase() : "";
    const at = typeof parsed.at === "number" ? parsed.at : 0;
    if (!email || !at || Date.now() - at > PENDING_SIGNIN_MAX_AGE_MS) return null;

    return { email, otpSent: parsed.otpSent === true };
  } catch {
    return null;
  }
}
