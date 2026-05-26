import { PRIZES } from "@/lib/constants";
import { pickPrizeIndex } from "@/lib/prizes";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Prize, Registration, TaskId } from "@/lib/types";

export async function registerDoctor(payload: Omit<Registration, "id" | "registeredAt">) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc("register_doctor", {
      p_full_name: payload.fullName,
      p_email: payload.email,
      p_mobile: payload.mobile,
      p_specialty: payload.specialty,
      p_practice_location: payload.location,
    });

    if (error) throw error;

    return {
      id: data as string,
      ...payload,
    };
  }

  return {
    id: `local-${Date.now()}`,
    ...payload,
  };
}

export async function updateTask(doctorId: string | null | undefined, taskId: TaskId, value: boolean) {
  if (!doctorId || !isSupabaseConfigured || !supabase) return;

  const { error } = await supabase.rpc("update_doctor_task", {
    p_doctor_id: doctorId,
    p_task: taskId,
    p_value: value,
  });

  if (error) throw error;
}

export async function claimPrize(doctorId: string | null | undefined): Promise<Prize> {
  if (doctorId && isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc("claim_prize", {
      p_doctor_id: doctorId,
    });

    if (error) throw error;

    const claimed = Array.isArray(data) ? data[0] : data;
    const matchingPrize = PRIZES.find((prize) => prize.label === claimed?.prize_label);

    return {
      label: claimed?.prize_label ?? matchingPrize?.label ?? "Welcome Gift",
      note:
        claimed?.prize_note ??
        matchingPrize?.note ??
        "Your prize has been recorded. We will follow up within three business days.",
      color: matchingPrize?.color ?? "#0608A9",
      text: matchingPrize?.text ?? "#F4F1EA",
      weight: matchingPrize?.weight ?? 1,
    };
  }

  return PRIZES[pickPrizeIndex()];
}
