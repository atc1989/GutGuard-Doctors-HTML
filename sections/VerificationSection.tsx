"use client";

import ActionButton from "@/components/ActionButton";
import { ArrowRightIcon } from "@/components/Icons";
import SectionLabel from "@/components/SectionLabel";
import TaskItem from "@/components/TaskItem";
import { LINKS, TASKS } from "@/lib/constants";
import type { RegistrationEmailDelivery, TaskId, TaskState } from "@/lib/types";

type VerificationSectionProps = {
  active: boolean;
  tasks: TaskState;
  emailDelivery: RegistrationEmailDelivery;
  onRetryEmail: () => void;
  onCompleteTask: (taskId: TaskId) => void;
  onContinue: () => void;
};

export default function VerificationSection({
  active,
  tasks,
  emailDelivery,
  onRetryEmail,
  onCompleteTask,
  onContinue,
}: VerificationSectionProps) {
  const allDone = Object.values(tasks).every(Boolean);

  function handleTask(taskId: TaskId) {
    if (tasks[taskId]) return;

    const link = LINKS[taskId];
    if (link) window.open(link, "_blank", "noopener");
    window.setTimeout(() => onCompleteTask(taskId), 400);
  }

  return (
    <section className={`screen ${active ? "active" : ""}`.trim()}>
      <SectionLabel number="ii.">Verification</SectionLabel>
      <p className="lede">
        Tap each row to open the right app. We mark each task complete the moment you
        return.
      </p>

      {emailDelivery.status !== "idle" ? (
        <div
          className={`registration-email-status ${emailDelivery.status}`}
          role={emailDelivery.status === "failed" ? "alert" : "status"}
          aria-live="polite"
        >
          <strong>
            {emailDelivery.status === "sending" && "Registration saved. Sending your email…"}
            {emailDelivery.status === "sent" && "Registration email sent."}
            {emailDelivery.status === "failed" && "Registration saved, but the email was not sent."}
            {emailDelivery.status === "not-requested" && "Registration saved without an email."}
          </strong>
          <span>
            {emailDelivery.status === "sending" && `We are delivering the onboarding documents to ${emailDelivery.email}.`}
            {emailDelivery.status === "sent" && `The onboarding documents were sent to ${emailDelivery.email}.`}
            {emailDelivery.status === "failed" && `Check ${emailDelivery.email}, then try sending the onboarding documents again.`}
            {emailDelivery.status === "not-requested" && "No onboarding email was requested. You can continue with verification."}
          </span>
          {emailDelivery.status === "failed" ? (
            <button type="button" onClick={onRetryEmail}>Try sending again</button>
          ) : null}
        </div>
      ) : null}

      <ul className="tasks">
        {TASKS.map((task) => (
          <TaskItem
            key={task.id}
            id={task.id}
            number={task.number}
            title={task.title}
            meta={task.meta}
            done={tasks[task.id]}
            hasTikTokMark={"hasTikTokMark" in task ? task.hasTikTokMark : false}
            onClick={handleTask}
          />
        ))}
      </ul>

      <ActionButton
        type="button"
        disabled={!allDone}
        onClick={onContinue}
        main="Continue to the wheel"
        sub={allDone ? "Ready" : "Complete all four to unlock"}
        icon={<ArrowRightIcon />}
      />
    </section>
  );
}
