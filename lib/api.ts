import type { Registration } from "@/lib/types";

export async function registerDoctor(payload: Omit<Registration, "id" | "registeredAt">) {
  return {
    id: `local-${Date.now()}`,
    ...payload,
  };
}

export async function updateTask() {
  return;
}

export async function recordSpin() {
  return;
}
