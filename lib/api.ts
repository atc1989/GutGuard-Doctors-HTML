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

type AdminDoctorRegistration = {
  id: string;
  full_name: string;
  email: string;
  mobile: string;
  tiktok_username: string;
  routing_slug: string;
  redirect_url: string;
  specialty: string;
  practice_location: string;
  created_at: string;
  prize_label?: string | null;
  prize_claimed_at?: string | null;
};

type AdminDoctorRegistrationUpdate = {
  id: string;
  full_name: string;
  email: string;
  mobile: string;
  tiktok_username: string;
  redirect_url: string;
  specialty: string;
  practice_location: string;
};

type NewsletterSendHistory = {
  id: string;
  doctor_id: string;
  newsletter_id?: string | null;
  newsletter_title?: string | null;
  email: string;
  subject: string;
  status: "sent" | "failed" | "skipped";
  resend_id?: string | null;
  error_message?: string | null;
  sent_at: string;
};

type NewsletterSendResult = {
  doctorId: string;
  email: string;
  status: "sent" | "failed" | "skipped";
  resendId?: string | null;
  error?: string | null;
};

type SmsSendHistory = {
  id: string;
  doctor_id: string;
  sms_campaign_id?: string | null;
  sms_campaign_title?: string | null;
  mobile: string;
  message: string;
  status: "sent" | "failed" | "skipped";
  provider_message_id?: string | null;
  error_message?: string | null;
  sent_at: string;
};

type SmsSendResult = {
  doctorId: string;
  mobile: string;
  status: "sent" | "failed" | "skipped";
  providerMessageId?: string | null;
  error?: string | null;
};

type NewsletterResponse = {
  sent: number;
  failed: number;
  skipped: number;
  results: NewsletterSendResult[];
};

type SmsBlastResponse = {
  sent: number;
  failed: number;
  skipped: number;
  results: SmsSendResult[];
};

export type RegistrationEmailAttachment = {
  id?: string;
  filename: string;
  contentType: string;
  size: number;
  path?: string;
  base64Content?: string;
};

export type RegistrationEmailSettings = {
  enabled: boolean;
  subject: string;
  replyTo: string;
  bodyText: string;
  html: string;
  attachments: RegistrationEmailAttachment[];
  updatedAt?: string;
  fromLabel?: string;
};

type RegistrationEmailSettingsResponse = {
  settings: RegistrationEmailSettings;
};

type RegistrationEmailTestResponse = {
  sent: boolean;
  resendId?: string;
};

export async function registerDoctor(payload: RegistrationPayload) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc("register_doctor", {
      p_full_name: payload.fullName,
      p_email: payload.email,
      p_mobile: payload.mobile,
      p_tiktok_username: payload.tiktokUsername,
      p_specialty: payload.specialty,
      p_practice_location: payload.location,
    });

    if (error) throw new Error(`Registration failed: ${error.message}`);

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

export async function getDoctorRegistrations(adminPassword: string): Promise<AdminDoctorRegistration[]> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("admin_list_doctor_registrations", {
    p_admin_password: adminPassword,
  });

  if (error) throw error;
  return ((data ?? []) as AdminDoctorRegistration[]).map(normalizeAdminDoctorRegistration);
}

export async function updateDoctorRegistration(
  adminPassword: string,
  doctor: AdminDoctorRegistrationUpdate,
): Promise<AdminDoctorRegistration> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("admin_update_doctor_registration", {
    p_admin_password: adminPassword,
    p_doctor_id: doctor.id,
    p_full_name: doctor.full_name,
    p_email: doctor.email,
    p_mobile: doctor.mobile,
    p_tiktok_username: doctor.tiktok_username,
    p_redirect_url: doctor.redirect_url,
    p_specialty: doctor.specialty,
    p_practice_location: doctor.practice_location,
  });

  if (error) throw error;
  return normalizeAdminDoctorRegistration((Array.isArray(data) ? data[0] : data) as AdminDoctorRegistration);
}

export async function getNewsletterSendHistory(adminPassword: string): Promise<NewsletterSendHistory[]> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("admin_list_newsletter_sends", {
    p_admin_password: adminPassword,
  });

  if (error) throw error;
  return (data ?? []) as NewsletterSendHistory[];
}

export async function sendNewsletter(
  adminPassword: string,
  doctorIds: string[],
  subject: string,
  html: string,
): Promise<NewsletterResponse> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.functions.invoke("send-newsletter", {
    body: { adminPassword, doctorIds, subject, html },
  });

  if (error) throw error;
  return data as NewsletterResponse;
}

export async function getSmsBlastHistory(adminPassword: string): Promise<SmsSendHistory[]> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("admin_list_sms_sends", {
    p_admin_password: adminPassword,
  });

  if (error) {
    if (isMissingSupabaseFunctionError(error)) return [];
    throw error;
  }
  return (data ?? []) as SmsSendHistory[];
}

export async function sendSmsBlast(
  adminPassword: string,
  doctorIds: string[],
  title: string,
  message: string,
): Promise<SmsBlastResponse> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.functions.invoke("send-sms-blast", {
    body: { adminPassword, doctorIds, title, message },
  });

  if (error) throw new Error(await getSupabaseFunctionErrorMessage(error));
  return data as SmsBlastResponse;
}

// ─── Email Sequence ────────────────────────────────────────────────────────

export type SequenceAttachment = {
  filename: string;
  content: string; // base64
  content_type: string;
  size: number;
};

export type SequenceStep = {
  id?: string;
  step_number: number;
  subject: string;
  html_body: string;
  attachments?: SequenceAttachment[];
  created_at?: string;
  updated_at?: string;
};

export type SequenceProgress = {
  id: string;
  doctor_id: string;
  current_step: number;
  enrolled_at: string;
  status: "active" | "completed";
  doctor_registrations: { full_name: string | null; email: string | null } | null;
  email_sequence_sends: { sent_at: string; clicked_at: string | null; status: string; step_id: string }[];
};

export async function getSequenceSteps(adminPassword: string): Promise<SequenceStep[]> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.functions.invoke("manage-sequence", {
    body: { action: "get-steps", adminPassword },
  });
  if (error) throw error;
  return (data as { steps: SequenceStep[] }).steps;
}

export async function upsertSequenceStep(
  adminPassword: string,
  step: { id?: string; stepNumber: number; subject: string; htmlBody: string; attachments?: SequenceAttachment[] },
): Promise<SequenceStep> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.functions.invoke("manage-sequence", {
    body: { action: "upsert-step", adminPassword, step },
  });
  if (error) throw error;
  return (data as { step: SequenceStep }).step;
}

export async function deleteSequenceStep(adminPassword: string, stepId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.functions.invoke("manage-sequence", {
    body: { action: "delete-step", adminPassword, stepId },
  });
  if (error) throw error;
}

export async function reorderSequenceSteps(adminPassword: string, stepIds: string[]): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.functions.invoke("manage-sequence", {
    body: { action: "reorder-steps", adminPassword, stepIds },
  });
  if (error) throw error;
}

export async function getSequenceProgress(
  adminPassword: string,
): Promise<{ progress: SequenceProgress[]; totalSteps: number }> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.functions.invoke("manage-sequence", {
    body: { action: "get-progress", adminPassword },
  });
  if (error) throw error;
  return data as { progress: SequenceProgress[]; totalSteps: number };
}

export async function enrollDoctorInSequence(doctorId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.functions.invoke("send-sequence-step", {
    body: { doctorId, stepNumber: 1 },
  });
  if (error) throw error;
}

// ─── Registration Email Settings ───────────────────────────────────────────

export async function getRegistrationEmailSettings(adminPassword: string): Promise<RegistrationEmailSettings> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.functions.invoke("registration-email-settings", {
    body: { action: "get", adminPassword },
  });

  if (error) throw error;
  return (data as RegistrationEmailSettingsResponse).settings;
}

export async function saveRegistrationEmailSettings(
  adminPassword: string,
  settings: RegistrationEmailSettings,
): Promise<RegistrationEmailSettings> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.functions.invoke("registration-email-settings", {
    body: { action: "save", adminPassword, settings },
  });

  if (error) throw error;
  return (data as RegistrationEmailSettingsResponse).settings;
}

export async function sendRegistrationEmailTest(
  adminPassword: string,
  testEmail: string,
): Promise<RegistrationEmailTestResponse> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.functions.invoke("registration-email-settings", {
    body: { action: "test", adminPassword, testEmail },
  });

  if (error) throw error;
  return data as RegistrationEmailTestResponse;
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

function normalizeAdminDoctorRegistration(doctor: AdminDoctorRegistration): AdminDoctorRegistration {
  const tiktokUsername = (doctor.tiktok_username ?? "").trim().replace(/^@+/, "").toLowerCase();
  const routingSlug = (doctor.routing_slug ?? "").trim() || slugifyDoctorRoute(doctor.full_name);

  return {
    ...doctor,
    tiktok_username: tiktokUsername,
    routing_slug: routingSlug,
    redirect_url:
      (doctor.redirect_url ?? "").trim() || (tiktokUsername ? `https://www.tiktok.com/@${tiktokUsername}` : ""),
  };
}

function slugifyDoctorRoute(value: string | null | undefined) {
  const slug = (value ?? "doctor")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "doctor";
}

async function getSupabaseFunctionErrorMessage(error: unknown) {
  const fallback = error instanceof Error ? error.message : "Supabase function request failed.";
  const maybeError = error as {
    context?: {
      json?: () => Promise<unknown>;
      text?: () => Promise<string>;
    };
  };

  try {
    const body = maybeError.context?.json ? await maybeError.context.json() : null;
    if (body && typeof body === "object" && "error" in body) {
      const message = (body as { error?: unknown }).error;
      if (typeof message === "string" && message.trim()) return message;
    }
  } catch {
    try {
      const text = maybeError.context?.text ? await maybeError.context.text() : "";
      if (text.trim()) return text;
    } catch {
      return fallback;
    }
  }

  return fallback;
}

function isMissingSupabaseFunctionError(error: unknown) {
  const maybeError = error as { code?: unknown; message?: unknown };
  return (
    maybeError.code === "PGRST202" ||
    (typeof maybeError.message === "string" && maybeError.message.includes("Could not find the function"))
  );
}
