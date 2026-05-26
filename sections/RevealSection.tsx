"use client";

import ActionButton from "@/components/ActionButton";
import { ArrowRightIcon } from "@/components/Icons";
import type { Registration } from "@/lib/types";

type RevealSectionProps = {
  active: boolean;
  registration: Registration | null;
  prize: string | null;
  prizeNote: string | null;
  onBackToRegistration: () => void;
};

export default function RevealSection({
  active,
  registration,
  prize,
  prizeNote,
  onBackToRegistration,
}: RevealSectionProps) {
  const reference = (registration?.id ?? "").replace("local-", "GG-").slice(0, 16);

  return (
    <section className={`screen reveal-stage ${active ? "active" : ""}`.trim()}>
      <div className="reveal-flourish">
        <span className="reveal-flourish-label">With our compliments</span>
      </div>
      <p className="reveal-name">
        Registered to <strong>{registration?.fullName ?? "--"}</strong>
      </p>
      <div className="prize">{prize ?? "--"}</div>
      <p className="prize-note">
        {prizeNote ??
          "Your prize has been recorded. We will follow up within three business days."}
      </p>

      <div className="reveal-meta">
        <div className="reveal-meta-row">
          <span className="reveal-meta-key">Program</span>
          <span className="reveal-meta-val">GutGuard LCA - Founding Cohort</span>
        </div>
        <div className="reveal-meta-row">
          <span className="reveal-meta-key">Reference</span>
          <span className="reveal-meta-val">{reference || "--"}</span>
        </div>
      </div>

      <ActionButton
        type="button"
        className="reveal-reset-action"
        main="Back to Registration"
        sub="Start another doctor"
        icon={<ArrowRightIcon />}
        onClick={onBackToRegistration}
      />
    </section>
  );
}
