"use client";

import { useMemo, useState, type CSSProperties } from "react";
import ActionButton from "@/components/ActionButton";
import { ArrowRightIcon, SpinIcon } from "@/components/Icons";
import SectionLabel from "@/components/SectionLabel";

type WheelPrize = {
  id?: string | number;
  label: string;
  color?: string | null;
  text?: string | null;
  textColor?: string | null;
  note?: string | null;
  stock?: number | null;
  remaining?: number | null;
  totalStock?: number | null;
  remainingStock?: number | null;
  available?: boolean | null;
  isActive?: boolean | null;
};

type SpinResult = WheelPrize | string | null;

type WheelSectionProps = {
  active: boolean;
  doctorName?: string | null;
  prizes?: readonly WheelPrize[] | null;
  loading?: boolean;
  error?: string | null;
  spinning?: boolean;
  spun?: boolean;
  prize?: SpinResult;
  result?: SpinResult;
  onSpin?: () => SpinResult | Promise<SpinResult | void> | void;
  onBackToRegistration: () => void;
};

const FALLBACK_PRIZES: readonly WheelPrize[] = [
  { label: "Welcome Gift", color: "#0608A9", text: "#F4F1EA", note: "Your prize has been recorded." },
  { label: "GutGuard Kit", color: "#B08D5B", text: "#0F0F18", note: "Please claim this with the booth team." },
  { label: "GCash Reward", color: "#04067A", text: "#F4F1EA", note: "Sent to your registered mobile." },
  { label: "Surprise Prize", color: "#F4F1EA", text: "#0F0F18", note: "The booth team will reveal your prize." },
];
const SPIN_DURATION_MS = 2800;

export default function WheelSection({
  active,
  doctorName,
  prizes,
  loading = false,
  error = null,
  spinning = false,
  spun = false,
  prize = null,
  result = null,
  onSpin,
  onBackToRegistration,
}: WheelSectionProps) {
  const [localSpinning, setLocalSpinning] = useState(false);
  const [localResult, setLocalResult] = useState<SpinResult>(null);
  const [spinError, setSpinError] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const segments = useMemo(() => normalizePrizes(prizes), [prizes]);
  const externalResult = result ?? prize ?? (spun ? "Prize recorded" : null);
  const visibleResult = localSpinning ? localResult : localResult ?? externalResult;
  const resultPrize = resolveResultPrize(visibleResult, segments);
  const isSpinning = spinning || localSpinning;
  const canSpin =
    Boolean(onSpin) && !loading && !error && segments.length > 0 && !isSpinning && !visibleResult;
  const wheelSlices = useMemo(() => buildWheelSlices(segments), [segments]);
  const wheelStyle = { "--wheel-rotation": `${rotation}deg` } as CSSProperties;

  async function handleSpin() {
    if (!canSpin || !onSpin) return;

    setLocalSpinning(true);
    setSpinError(null);
    try {
      const nextResult = await onSpin();
      const claimedPrize = resolveResultPrize(nextResult ?? externalResult, segments);
      const nextRotation = rotation + 1440 + resultAngle(claimedPrize, segments);

      setRotation(nextRotation);
      window.setTimeout(() => {
        setLocalResult(nextResult ?? claimedPrize ?? "Prize recorded");
        setLocalSpinning(false);
      }, SPIN_DURATION_MS);
    } catch (caught) {
      console.error("Prize claim failed", caught);
      setSpinError("The wheel could not complete the spin. Please try again.");
      setLocalSpinning(false);
    }
  }

  return (
    <section className={`screen wheel-stage ${active ? "active" : ""}`.trim()}>
      <SectionLabel number="iii.">Prize Wheel</SectionLabel>

      <div className="wheel-intro">
        <p className="wheel-kicker">Congratulations{doctorName ? `, Dr. ${doctorName}` : ""}</p>
        <h1>
          Your affiliate slot is <em>confirmed.</em>
        </h1>
        <p className="lede">
          Spin once to reveal your GutGuard booth prize.
        </p>
      </div>

      <div className={`wheel-panel ${visibleResult ? "has-result" : ""}`.trim()}>
        <div className="wheel-frame" aria-live="polite">
          <div className="wheel-pointer" aria-hidden="true" />
          <div className="wheel-disc-wrap" style={wheelStyle}>
            <svg
              className="wheel-disc"
              viewBox="0 0 100 100"
              aria-label="Prize wheel"
              role="img"
            >
              <circle className="wheel-disc-rim" cx="50" cy="50" r="49" />
              {wheelSlices.map((slice) => (
                <g key={`${slice.segment.id ?? slice.segment.label}-${slice.index}`}>
                  <path
                    className="wheel-slice"
                    d={slice.path}
                    fill={slice.segment.color ?? defaultSegmentColor(slice.index)}
                  />
                  <path className="wheel-slice-rule" d={slice.path} />
                  <text
                    className="wheel-segment-label"
                    fill={slice.segment.textColor ?? slice.segment.text ?? "#F4F1EA"}
                    x={slice.label.x}
                    y={slice.label.y}
                    transform={`rotate(${slice.label.rotation} ${slice.label.x} ${slice.label.y})`}
                  >
                    {formatWheelLabel(slice.segment.label).map((line, lineIndex) => (
                      <tspan
                        key={`${line}-${lineIndex}`}
                        x={slice.label.x}
                        dy={lineIndex === 0 ? 0 : 4.4}
                      >
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              ))}
              <circle className="wheel-inner-ring" cx="50" cy="50" r="27" />
            </svg>
          </div>
          <div className={`wheel-hub ${isSpinning ? "spinning" : ""}`.trim()}>
            <span>GG</span>
          </div>
        </div>

        <div className="wheel-status">
          {loading ? (
            <WheelNotice title="Loading prizes" copy="Checking available segments and current stock." />
          ) : error ? (
            <WheelNotice title="Wheel unavailable" copy={error} tone="error" />
          ) : spinError ? (
            <WheelNotice title="Spin not completed" copy={spinError} tone="error" />
          ) : isSpinning ? (
            <WheelNotice title="Wheel spinning" copy="Your prize is being revealed." />
          ) : visibleResult ? (
            <WheelResult prize={resultPrize} />
          ) : (
            <WheelNotice
              title="One spin ready"
              copy={`${segments.length} prize ${segments.length === 1 ? "segment" : "segments"} available.`}
            />
          )}
        </div>
      </div>

      {!visibleResult ? (
        <ActionButton
          type="button"
          className="action-spin"
          main={isSpinning ? "Spinning..." : "Spin the Wheel"}
          sub={loading ? "Preparing prizes" : "Claim one booth prize"}
          icon={isSpinning ? <span className="spinner" /> : <SpinIcon />}
          onClick={handleSpin}
          disabled={!canSpin}
        />
      ) : (
        <ActionButton
          type="button"
          className="reveal-reset-action"
          main="Back to Registration"
          sub="Start another doctor"
          icon={<ArrowRightIcon />}
          onClick={onBackToRegistration}
        />
      )}
    </section>
  );
}

function WheelNotice({
  title,
  copy,
  tone,
}: {
  title: string;
  copy: string;
  tone?: "error";
}) {
  return (
    <div className={`wheel-notice ${tone === "error" ? "wheel-error" : ""}`.trim()}>
      <p className="wheel-notice-title">{title}</p>
      <p className="wheel-notice-copy">{copy}</p>
    </div>
  );
}

function WheelResult({ prize }: { prize: WheelPrize | null }) {
  return (
    <div className="wheel-result">
      <p className="wheel-result-eyebrow">Prize Claimed</p>
      <p className="wheel-result-title">{prize?.label ?? "Prize recorded"}</p>
      <p className="wheel-result-copy">
        {prize?.note ?? "Your prize has been recorded. Please confirm your claim with the booth team."}
      </p>
    </div>
  );
}

function normalizePrizes(prizes?: readonly WheelPrize[] | null) {
  const availablePrizes = (prizes?.length ? prizes : FALLBACK_PRIZES)
    .filter((prize) => prize.label)
    .filter((prize) => prize.available !== false && prize.isActive !== false)
    .filter((prize) => {
      const stock = prize.remainingStock ?? prize.remaining ?? prize.stock ?? prize.totalStock;
      return stock === null || stock === undefined || stock > 0;
    });

  return availablePrizes.length ? availablePrizes : [];
}

function buildWheelSlices(segments: readonly WheelPrize[]) {
  const sliceAngle = 360 / Math.max(segments.length, 1);

  return segments.map((segment, index) => {
    const startAngle = -90 + index * sliceAngle;
    const endAngle = startAngle + sliceAngle;
    const middleAngle = startAngle + sliceAngle / 2;
    const label = polarToCartesian(50, 50, 32, middleAngle);
    const normalizedRotation = middleAngle > 90 && middleAngle < 270 ? middleAngle + 180 : middleAngle;

    return {
      segment,
      index,
      path: describeSlice(50, 50, 47, startAngle, endAngle),
      label: {
        x: label.x,
        y: label.y,
        rotation: normalizedRotation,
      },
    };
  });
}

function resolveResultPrize(result: SpinResult, segments: readonly WheelPrize[]) {
  if (!result) return null;
  if (typeof result !== "string") return result;

  return segments.find((segment) => segment.label === result || String(segment.id) === result) ?? {
    label: result,
  };
}

function resultAngle(result: WheelPrize | null, segments: readonly WheelPrize[]) {
  if (!result) return 0;

  const index = segments.findIndex(
    (segment) => segment.label === result.label || String(segment.id) === String(result.id),
  );
  if (index < 0) return 0;

  const slice = 360 / segments.length;
  return 360 - (index * slice + slice / 2);
}

function defaultSegmentColor(index: number) {
  return ["#0608A9", "#B08D5B", "#04067A", "#F4F1EA", "#0F0F18", "#C9AC7E"][index % 6];
}

function describeSlice(centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    `M ${centerX} ${centerY}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function formatWheelLabel(label: string) {
  const words = label.split(/\s+/);
  const lines = words.reduce<string[]>((currentLines, word) => {
    const lastLine = currentLines[currentLines.length - 1];
    if (!lastLine || `${lastLine} ${word}`.length > 13) return [...currentLines, word];
    return [...currentLines.slice(0, -1), `${lastLine} ${word}`];
  }, []);

  return lines.slice(0, 3);
}
