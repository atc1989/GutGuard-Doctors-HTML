"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import ProgressRail from "@/components/ProgressRail";
import RegistrationSection from "@/sections/RegistrationSection";
import VerificationSection from "@/sections/VerificationSection";
import WheelSection from "@/sections/WheelSection";
import RevealSection from "@/sections/RevealSection";
import { claimPrize, updateTask } from "@/lib/api";
import { getPrizeByLabel } from "@/lib/prizes";
import { INITIAL_STATE, loadExperienceState, saveExperienceState } from "@/lib/storage";
import type { ExperienceState, Prize, Registration, Screen, TaskId } from "@/lib/types";

export default function RegistrationExperience() {
  const [state, setState] = useState<ExperienceState>(INITIAL_STATE);
  const [screen, setScreen] = useState<Screen>(1);
  const [isHydrated, setIsHydrated] = useState(false);

  const dateLabel = useMemo(
    () => new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date()),
    [],
  );

  useEffect(() => {
    const saved = loadExperienceState();
    setState(saved);
    setScreen(resolveScreen(saved));
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) saveExperienceState(state);
  }, [isHydrated, state]);

  useEffect(() => {
    if (!isHydrated || !state.registration || state.tasks.email) return;

    const nextState = {
      ...state,
      tasks: { ...state.tasks, email: true },
    };

    setState(nextState);
    setScreen(resolveScreen(nextState));
    updateTask(state.registration.id, "email", true).catch(() => {
      console.warn("Email verification update failed; keeping local email task completed.");
    });
  }, [isHydrated, state]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [screen]);

  function handleRegistered(registration: Registration) {
    setState((current) => ({
      ...current,
      registration,
      tasks: { ...current.tasks, email: true },
    }));
    updateTask(registration.id, "email", true).catch(() => {
      window.alert("Registration saved, but email verification could not be recorded.");
    });
    setScreen(2);
  }

  async function handleCompleteTask(taskId: TaskId) {
    if (state.tasks[taskId]) return;

    setState((current) => ({
      ...current,
      tasks: { ...current.tasks, [taskId]: true },
    }));

    try {
      await updateTask(state.registration?.id, taskId, true);
    } catch {
      console.warn("Task update failed; keeping the local task state completed.");
    }
  }

  function handlePrizeWon(prize: Prize) {
    setState((current) => ({
      ...current,
      spun: true,
      prize: prize.label,
      prizeNote: prize.note,
    }));
    paperConfetti();
    window.setTimeout(() => setScreen(4), 800);
  }

  const activePrize = getPrizeByLabel(state.prize);

  return (
    <main className="stage">
      <ProgressRail screen={screen} />
      <Header dateLabel={dateLabel} />
      <RegistrationSection active={screen === 1} onRegistered={handleRegistered} />
      <VerificationSection
        active={screen === 2}
        tasks={state.tasks}
        onCompleteTask={handleCompleteTask}
        onContinue={() => setScreen(3)}
      />
      <WheelSection
        active={screen === 3}
        spun={state.spun}
        onClaimPrize={() => claimPrize(state.registration?.id)}
        onPrizeWon={handlePrizeWon}
      />
      <RevealSection
        active={screen === 4}
        registration={state.registration}
        prize={activePrize?.label ?? state.prize}
        prizeNote={activePrize?.note ?? state.prizeNote}
      />

      <div className="colophon">
        <span>GutGuard · IG International Corp.</span>
        <span className="colophon-l">FDA CPR No. FR-40000015571456</span>
      </div>
    </main>
  );
}

function resolveScreen(state: ExperienceState): Screen {
  if (state.spun && state.prize) return 4;
  if (state.registration && Object.values(state.tasks).every(Boolean)) return 3;
  if (state.registration) return 2;
  return 1;
}

function paperConfetti() {
  const palette = ["#0608A9", "#B08D5B", "#F4F1EA", "#0F0F18", "#04067A"];

  for (let i = 0; i < 50; i += 1) {
    const piece = document.createElement("div");
    const isRect = Math.random() > 0.5;
    piece.className = "confetti";
    piece.style.width = `${isRect ? 10 : 6}px`;
    piece.style.height = `${isRect ? 3 : 6}px`;
    piece.style.background = palette[Math.floor(Math.random() * palette.length)];
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.top = "-30px";
    piece.style.opacity = `${0.7 + Math.random() * 0.3}`;
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    piece.style.animationDuration = `${3 + Math.random() * 2}s`;
    piece.style.animationDelay = `${Math.random() * 0.4}s`;
    document.body.appendChild(piece);
    window.setTimeout(() => piece.remove(), 6000);
  }
}
