"use client";

import { useState } from "react";
import ActionButton from "@/components/ActionButton";
import { ArrowRightIcon } from "@/components/Icons";
import SectionLabel from "@/components/SectionLabel";
import type { Prize } from "@/lib/types";

type WheelSectionProps = {
  active: boolean;
  spun: boolean;
  onClaimPrize: () => Promise<Prize>;
  onPrizeWon: (prize: Prize) => void;
};

export default function WheelSection({
  active,
  spun,
  onClaimPrize,
  onPrizeWon,
}: WheelSectionProps) {
  const [isClaiming, setIsClaiming] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function claimGift() {
    if (spun || isClaiming) return;

    setIsClaiming(true);
    setErrorMessage("");

    try {
      const prize = await onClaimPrize();
      onPrizeWon(prize);
    } catch {
      setErrorMessage("Gift claim failed. Please ask the booth coordinator to try again.");
      setIsClaiming(false);
    }
  }

  return (
    <section className={`screen wheel-stage ${active ? "active" : ""}`.trim()}>
      <SectionLabel number="iii.">Congratulations</SectionLabel>

      <div className="congrats-banner">
        <p className="congrats-title">Congratulations, Doctor!</p>
        <p className="congrats-copy">
          You&apos;ve officially joined the <strong>GutGuard Doctors&apos; TikTok Affiliate Program</strong>.
        </p>

        <div className="congrats-card">
          <p className="congrats-card-lead">Present this message to the nearest GutGuard exhibitor and get</p>
          <p className="congrats-card-highlight">1 FREE SPIN</p>
          <p className="congrats-card-sub">in our event roleta.</p>
        </div>

        <p className="congrats-footnote">Thank you for being part of GutGuard.</p>
      </div>

      <ActionButton
        type="button"
        className="action-spin"
        disabled={spun || isClaiming}
        onClick={claimGift}
        main={isClaiming ? "Claiming your gift" : "Continue"}
        sub={spun ? "Gift recorded" : "Record and proceed"}
        icon={<ArrowRightIcon />}
      />

      {errorMessage && <p className="field-err wheel-error">{errorMessage}</p>}
    </section>
  );
}
