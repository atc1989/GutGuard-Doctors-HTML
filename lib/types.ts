import type { TASKS } from "@/lib/constants";

export type Screen = 1 | 2 | 3 | 4;
export type TaskId = (typeof TASKS)[number]["id"];

export type Registration = {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  specialty: string;
  location: string;
  registeredAt: number;
};

export type RegistrationPayload = Omit<Registration, "id" | "registeredAt">;

export type TaskState = Record<TaskId, boolean>;

export type ExperienceState = {
  registration: Registration | null;
  tasks: TaskState;
  spun: boolean;
  prize: string | null;
  prizeNote: string | null;
};

export type Prize = {
  label: string;
  color: string;
  text: string;
  weight: number;
  note: string;
};
