"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import ProgressRail from "@/components/ProgressRail";
import RegistrationSection from "@/sections/RegistrationSection";
import VerificationSection from "@/sections/VerificationSection";
import WheelSection from "@/sections/WheelSection";
import { claimPrize, enrollDoctorInSequence, listWheelPrizes, updateTask } from "@/lib/api";
import {
  clearExperienceState,
  INITIAL_STATE,
  loadExperienceState,
  saveExperienceState,
} from "@/lib/storage";
import type {
  ExperienceState,
  Prize,
  Registration,
  RegistrationEmailDelivery,
  Screen,
  TaskId,
  WheelPrize,
} from "@/lib/types";

export default function RegistrationExperience() {
  const [state, setState] = useState<ExperienceState>(INITIAL_STATE);
  const [screen, setScreen] = useState<Screen>(1);
  const [isHydrated, setIsHydrated] = useState(false);
  const [registrationResetKey, setRegistrationResetKey] = useState(0);
  const [wheelPrizes, setWheelPrizes] = useState<WheelPrize[]>([]);
  const [wheelLoading, setWheelLoading] = useState(false);
  const [wheelError, setWheelError] = useState<string | null>(null);
  const [emailDelivery, setEmailDelivery] = useState<RegistrationEmailDelivery>({ status: "idle" });

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

  useEffect(() => {
    if (screen !== 3) return;

    setWheelLoading(true);
    setWheelError(null);
    listWheelPrizes()
      .then(setWheelPrizes)
      .catch(() => {
        setWheelError("The prize wheel could not load. Please ask the booth coordinator to refresh.");
      })
      .finally(() => setWheelLoading(false));
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
    void deliverRegistrationEmail(registration);
    setScreen(2);
  }

  async function deliverRegistrationEmail(registration: Registration) {
    const email = registration.email.trim();
    if (!email) {
      setEmailDelivery({ status: "not-requested" });
      return;
    }

    setEmailDelivery({ status: "sending", email });
    try {
      await enrollDoctorInSequence(registration.id);
      setEmailDelivery({ status: "sent", email });
    } catch (error) {
      console.error("Registration email delivery failed:", error);
      setEmailDelivery({ status: "failed", email });
    }
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

  async function handleClaimPrize(): Promise<Prize> {
    if (state.spun && state.prize) return state.prize;

    const prize = await claimPrize(state.registration?.id);
    setState((current) => ({
      ...current,
      spun: true,
      prize,
      prizeNote: prize.note,
    }));
    return prize;
  }

  function handleBackToRegistration() {
    clearExperienceState();
    setState(INITIAL_STATE);
    setEmailDelivery({ status: "idle" });
    setRegistrationResetKey((current) => current + 1);
    setScreen(1);
  }


  return (
    <main className="stage">
      <ProgressRail screen={screen} />
      <Header dateLabel={dateLabel} />
      <RegistrationSection
        key={registrationResetKey}
        active={screen === 1}
        onRegistered={handleRegistered}
      />
      <VerificationSection
        active={screen === 2}
        tasks={state.tasks}
        emailDelivery={emailDelivery}
        onRetryEmail={() => {
          if (state.registration) void deliverRegistrationEmail(state.registration);
        }}
        onCompleteTask={handleCompleteTask}
        onContinue={() => setScreen(3)}
      />
      <WheelSection
        active={screen === 3}
        doctorName={state.registration?.fullName}
        prizes={wheelPrizes}
        loading={wheelLoading}
        error={wheelError}
        spun={state.spun}
        prize={state.prize}
        onSpin={handleClaimPrize}
        onBackToRegistration={handleBackToRegistration}
      />

      <div className="colophon">
        <span>GutGuard . innovision grand international opc</span>
        <span className="colophon-l">FDA CPR No. FR-40000015571456</span>
      </div>
    </main>
  );
}

function resolveScreen(state: ExperienceState): Screen {
  if (state.registration && Object.values(state.tasks).every(Boolean)) return 3;
  if (state.registration) return 2;
  return 1;
}

