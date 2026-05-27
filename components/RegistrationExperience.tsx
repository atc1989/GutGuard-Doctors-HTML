"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import ProgressRail from "@/components/ProgressRail";
import RegistrationSection from "@/sections/RegistrationSection";
import VerificationSection from "@/sections/VerificationSection";
import WheelSection from "@/sections/WheelSection";
import { updateTask } from "@/lib/api";
import {
  clearExperienceState,
  INITIAL_STATE,
  loadExperienceState,
  saveExperienceState,
} from "@/lib/storage";
import type { ExperienceState, Registration, Screen, TaskId } from "@/lib/types";

export default function RegistrationExperience() {
  const [state, setState] = useState<ExperienceState>(INITIAL_STATE);
  const [screen, setScreen] = useState<Screen>(1);
  const [isHydrated, setIsHydrated] = useState(false);
  const [registrationResetKey, setRegistrationResetKey] = useState(0);

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


  function handleBackToRegistration() {
    clearExperienceState();
    setState(INITIAL_STATE);
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
        onCompleteTask={handleCompleteTask}
        onContinue={() => setScreen(3)}
      />
      <WheelSection
        active={screen === 3}
        doctorName={state.registration?.fullName}
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

