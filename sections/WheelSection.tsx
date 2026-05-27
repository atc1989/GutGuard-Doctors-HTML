"use client";

import ActionButton from "@/components/ActionButton";
import { ArrowRightIcon } from "@/components/Icons";
import SectionLabel from "@/components/SectionLabel";

type WheelSectionProps = {
  active: boolean;
  doctorName?: string | null;
  onBackToRegistration: () => void;
};

export default function WheelSection({
  active,
  doctorName,
  onBackToRegistration,
}: WheelSectionProps) {
  return (
    <section className={`screen wheel-stage ${active ? "active" : ""}`.trim()}>
      <SectionLabel number="iii.">Congratulations</SectionLabel>

      <div className="congrats-banner">
        <p className="congrats-title">
          <span className="congrats-title-prefix">Congratulations, Doctor</span>
          {doctorName ? <span className="congrats-title-name">{doctorName}</span> : null}
          <span className="congrats-title-mark">!</span>
        </p>
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
        className="reveal-reset-action"
        main="Back to Registration"
        sub="Start another doctor"
        icon={<ArrowRightIcon />}
        onClick={onBackToRegistration}
      />
    </section>
  );
}
