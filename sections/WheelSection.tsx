"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import ActionButton from "@/components/ActionButton";
import { SpinIcon } from "@/components/Icons";
import SectionLabel from "@/components/SectionLabel";
import { PRIZES } from "@/lib/constants";
import { pickPrizeIndex } from "@/lib/prizes";
import type { Prize } from "@/lib/types";

type WheelSectionProps = {
  active: boolean;
  spun: boolean;
  onPrizeWon: (prize: Prize) => void;
};

export default function WheelSection({ active, spun, onPrizeWon }: WheelSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationRef = useRef(0);
  const [isSpinning, setIsSpinning] = useState(false);

  useEffect(() => {
    if (active) drawWheel(rotationRef.current);
  }, [active]);

  function drawWheel(rotation = 0) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const width = canvas.width;
    const center = width / 2;
    const radius = width / 2 - 12;
    const slice = (Math.PI * 2) / PRIZES.length;

    ctx.clearRect(0, 0, width, width);
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(rotation);

    PRIZES.forEach((prize, index) => {
      const start = index * slice - Math.PI / 2;
      const end = start + slice;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = prize.color;
      ctx.fill();
      ctx.strokeStyle = "rgba(244, 241, 234, 0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.save();
      ctx.rotate(start + slice / 2);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = prize.text;
      ctx.font = '500 24px "Inter Tight", sans-serif';

      const lines = wrapCanvasText(ctx, prize.label, radius * 0.55);
      const lineHeight = 28;
      const totalHeight = (lines.length - 1) * lineHeight;
      lines.forEach((line, lineIndex) => {
        ctx.fillText(line, radius - 30, -totalHeight / 2 + lineIndex * lineHeight);
      });
      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "#B08D5B";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radius - 6, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(176, 141, 91, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  function spin() {
    if (spun || isSpinning) return;

    setIsSpinning(true);
    const index = pickPrizeIndex();
    const prize = PRIZES[index];
    const slice = (Math.PI * 2) / PRIZES.length;
    const target = -index * slice - slice / 2;
    const turns = 7 + Math.random() * 2;
    const start = rotationRef.current;
    const finalRotation =
      start + turns * Math.PI * 2 + (target - (start % (Math.PI * 2)));
    const duration = 5800;
    const startTime = performance.now();
    const ease = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

    function tick(now: number) {
      const t = Math.min((now - startTime) / duration, 1);
      rotationRef.current = start + (finalRotation - start) * ease(t);
      drawWheel(rotationRef.current);

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        setIsSpinning(false);
        onPrizeWon(prize);
      }
    }

    requestAnimationFrame(tick);
  }

  return (
    <section className={`screen wheel-stage ${active ? "active" : ""}`.trim()}>
      <SectionLabel number="iii.">The Welcome Gift</SectionLabel>
      <p className="lede">One spin. Whatever lands is yours, with our compliments.</p>

      <div className="wheel-frame">
        <div className="wheel-pointer">
          <svg viewBox="0 0 26 32" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M 13 32 L 2 4 Q 13 0 24 4 Z"
              fill="#B08D5B"
              stroke="#8C6E40"
              strokeWidth="0.5"
            />
          </svg>
        </div>
        <canvas id="wheelCanvas" ref={canvasRef} width="800" height="800" />
        <div className={`wheel-hub ${isSpinning ? "spinning" : ""}`.trim()}>
          <Image src="/gutguard-logo.png" alt="" width={80} height={120} />
        </div>
      </div>

      <ActionButton
        type="button"
        className="action-spin"
        disabled={spun || isSpinning}
        onClick={spin}
        main={
          isSpinning ? (
            <>
              <span className="spinner" style={{ display: "inline-block", verticalAlign: "middle", marginRight: 8 }} />
              Spinning
            </>
          ) : (
            "Spin the wheel"
          )
        }
        sub="One opportunity"
        icon={<SpinIcon />}
      />
    </section>
  );
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const lines: string[] = [];
  let line = "";

  for (const word of text.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }

  if (line) lines.push(line);
  return lines;
}
