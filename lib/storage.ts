import { LOCAL_KEY } from "@/lib/constants";
import type { ExperienceState } from "@/lib/types";

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
