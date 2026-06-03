import { PRIZES } from "@/lib/constants";
import { pickPrizeIndex } from "@/lib/prizes";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Prize, RegistrationPayload, TaskId, WheelPrize, WheelPrizeInput } from "@/lib/types";

type PrizeRow = {
  id?: string;
  prize_id?: string;
  label?: string;
  prize_label?: string;
  note?: string;
  prize_note?: string;
  color?: string;
  text?: string;
  text_color?: string;
  chance_weight?: number;
  total_stock?: number;
  remaining_stock?: number;
  is_active?: boolean;
  sort_order?: number;
  claim_count?: number;
};

type AdminWheelPrize = {
  id?: string;
  label: string;
  note: string;
  color: string;
  text: string;
  chance_weight: number;
  total_stock: number;
  remaining_stock: number;
  is_active: boolean;
  sort_order: number;
  claim_count?: number;
};

export async function registerDoctor(payload: RegistrationPayload) {
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

export async function sendProposalEmail(registrationId: string) {
  if (!isSupabaseConfigured || !supabase || registrationId.startsWith("local-")) return;

  const { error } = await supabase.functions.invoke("send-proposal", {
    body: { registrationId },
  });

  if (error) throw error;
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

export async function listWheelPrizes(): Promise<WheelPrize[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc("list_wheel_prizes");
    if (error) throw error;
    return ((data ?? []) as PrizeRow[]).map(mapWheelPrizeRow);
  }

  return PRIZES.map((prize, index) => ({
    id: `local-${index}`,
    label: prize.label,
    note: prize.note,
    color: prize.color,
    text: prize.text,
    textColor: prize.text,
    weight: prize.weight,
    chanceWeight: prize.weight,
    totalStock: 999,
    remainingStock: 999,
    isActive: true,
    sortOrder: index,
    claimCount: 0,
  }));
}

export async function claimPrize(doctorId: string | null | undefined): Promise<Prize> {
  if (doctorId && isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc("claim_prize", {
      p_doctor_id: doctorId,
    });

    if (error) throw error;

    const claimed = Array.isArray(data) ? data[0] : data;
    return mapClaimedPrize(claimed as PrizeRow | null | undefined);
  }

  return PRIZES[pickPrizeIndex()];
}

export async function adminListWheelPrizes(adminPassword: string): Promise<WheelPrize[]> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("admin_list_wheel_prizes", {
    p_admin_password: adminPassword,
  });

  if (error) throw error;
  return ((data ?? []) as PrizeRow[]).map(mapWheelPrizeRow);
}

export async function adminSaveWheelPrize(
  adminPassword: string,
  prize: WheelPrizeInput,
): Promise<WheelPrize> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("admin_upsert_wheel_prize", {
    p_admin_password: adminPassword,
    p_id: prize.id ?? null,
    p_label: prize.label,
    p_note: prize.note,
    p_color: prize.color,
    p_text_color: prize.textColor,
    p_chance_weight: prize.chanceWeight,
    p_total_stock: prize.totalStock,
    p_remaining_stock: prize.remainingStock,
    p_is_active: prize.isActive,
    p_sort_order: prize.sortOrder,
  });

  if (error) throw error;
  return mapWheelPrizeRow((Array.isArray(data) ? data[0] : data) as PrizeRow);
}

export async function getWheelPrizes(adminPassword: string): Promise<AdminWheelPrize[]> {
  const prizes = await adminListWheelPrizes(adminPassword);
  return prizes.map(mapAdminWheelPrize);
}

export async function saveWheelPrize(
  adminPassword: string,
  prize: AdminWheelPrize,
): Promise<AdminWheelPrize> {
  const saved = await adminSaveWheelPrize(adminPassword, mapWheelPrizeInput(prize));
  return mapAdminWheelPrize(saved);
}

export async function createWheelPrize(
  adminPassword: string,
  prize: Omit<AdminWheelPrize, "id">,
): Promise<AdminWheelPrize> {
  const saved = await adminSaveWheelPrize(adminPassword, mapWheelPrizeInput(prize));
  return mapAdminWheelPrize(saved);
}

function mapClaimedPrize(row: PrizeRow | null | undefined): Prize {
  const matchingPrize = PRIZES.find((prize) => prize.label === row?.prize_label || prize.label === row?.label);

  return {
    id: row?.prize_id ?? row?.id,
    label: row?.prize_label ?? row?.label ?? matchingPrize?.label ?? "Welcome Gift",
    note:
      row?.prize_note ??
      row?.note ??
      matchingPrize?.note ??
      "Your prize has been recorded. We will follow up within three business days.",
    color: row?.color ?? matchingPrize?.color ?? "#0608A9",
    text: row?.text_color ?? row?.text ?? matchingPrize?.text ?? "#F4F1EA",
    textColor: row?.text_color ?? row?.text ?? matchingPrize?.text ?? "#F4F1EA",
    weight: row?.chance_weight ?? matchingPrize?.weight ?? 1,
    chanceWeight: row?.chance_weight ?? matchingPrize?.weight ?? 1,
    totalStock: row?.total_stock,
    remainingStock: row?.remaining_stock,
    isActive: row?.is_active,
    sortOrder: row?.sort_order,
  };
}

function mapWheelPrizeRow(row: PrizeRow): WheelPrize {
  return {
    id: row.id ?? row.prize_id ?? "",
    label: row.label ?? row.prize_label ?? "Prize",
    note: row.note ?? row.prize_note ?? "",
    color: row.color ?? "#0608A9",
    text: row.text_color ?? row.text ?? "#F4F1EA",
    textColor: row.text_color ?? row.text ?? "#F4F1EA",
    weight: row.chance_weight ?? 1,
    chanceWeight: row.chance_weight ?? 1,
    totalStock: row.total_stock ?? 0,
    remainingStock: row.remaining_stock ?? 0,
    isActive: row.is_active ?? true,
    sortOrder: row.sort_order ?? 0,
    claimCount: row.claim_count ?? 0,
  };
}

function mapWheelPrizeInput(prize: AdminWheelPrize | Omit<AdminWheelPrize, "id">): WheelPrizeInput {
  return {
    id: "id" in prize ? prize.id : undefined,
    label: prize.label,
    note: prize.note,
    color: prize.color,
    textColor: prize.text,
    chanceWeight: prize.chance_weight,
    totalStock: prize.total_stock,
    remainingStock: prize.remaining_stock,
    isActive: prize.is_active,
    sortOrder: prize.sort_order,
  };
}

function mapAdminWheelPrize(prize: WheelPrize): AdminWheelPrize {
  return {
    id: prize.id,
    label: prize.label,
    note: prize.note,
    color: prize.color,
    text: prize.textColor,
    chance_weight: prize.chanceWeight,
    total_stock: prize.totalStock,
    remaining_stock: prize.remainingStock,
    is_active: prize.isActive,
    sort_order: prize.sortOrder,
    claim_count: prize.claimCount,
  };
}
