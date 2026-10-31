import { SHOP_SCHEMA } from "@/lib/supabase";
import {
  isSupabaseAdminConfigured as isSupabaseConfigured,
  supabaseAdmin as supabase,
  supabaseAdminShop as supabaseShop,
} from "@/lib/supabase-admin";
import { PARTNER_SLUG_PATTERN, RESERVED_PARTNER_SLUGS } from "@/lib/referral";
import type { AdminTestimonial, TestimonialStatus } from "@/lib/testimonials";
import type { Prize, WheelPrize, WheelPrizeInput } from "@/lib/types";
import { cleanFulfillment } from "@/lib/order-fulfillment";
import type {
  AdminDoctorRegistration,
  AdminDoctorRegistrationUpdate,
  AdminWheelPrize,
  NewsletterResponse,
  PartnerWithdrawal,
  NewsletterSendHistory,
  RegistrationEmailSettings,
  SequenceProgress,
  SequenceStep,
  SequenceAttachment,
  ShopOrder,
  ShopOrderAdminUpdate,
  ShopOrderItem,
  ShopOrderStatus,
  ShopPaymentStatus,
  SmsBlastResponse,
  SmsSendHistory,
} from "@/lib/api";

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

function mapWheelPrizeRow(row: PrizeRow): WheelPrize {
  return {
    id: row.id ?? row.prize_id ?? `prize-${Math.random()}`,
    label: row.label ?? row.prize_label ?? "Prize",
    note: row.note ?? row.prize_note ?? "",
    color: row.color ?? "#0f172a",
    text: row.text ?? row.label ?? row.prize_label ?? "Prize",
    textColor: row.text_color ?? "#ffffff",
    weight: Number(row.chance_weight ?? 1),
    chanceWeight: Number(row.chance_weight ?? 1),
    totalStock: Number(row.total_stock ?? 0),
    remainingStock: Number(row.remaining_stock ?? 0),
    isActive: Boolean(row.is_active ?? true),
    sortOrder: Number(row.sort_order ?? 0),
    claimCount: Number(row.claim_count ?? 0),
  };
}

function normalizeAdminDoctorRegistration(doctor: AdminDoctorRegistration): AdminDoctorRegistration {
  const routingSlug = (doctor.routing_slug ?? "").trim() || slugifyDoctorRoute(doctor.full_name);

  return {
    ...doctor,
    name_prefix: doctor.name_prefix ?? "",
    routing_slug: routingSlug,
    where_did_you_find_us: doctor.where_did_you_find_us ?? "",
    referred_by_partner_id: doctor.referred_by_partner_id ?? null,
    referrer_name: doctor.referrer_name ?? null,
    referrer_prefix: doctor.referrer_prefix ?? null,
    referrer_slug: doctor.referrer_slug ?? null,
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

function normalizeShopOrder(row: unknown): ShopOrder {
  const order = (row ?? {}) as Record<string, unknown>;
  const subtotal = Number(order.subtotal ?? 0);
  const shippingFee = Number(order.shipping_fee ?? 0);
  const totalAmount = Number(order.total_amount ?? 0) || subtotal + shippingFee;

  return {
    id: String(order.id ?? ""),
    order_code: String(order.order_code ?? ""),
    status: (order.status ?? "pending_payment") as ShopOrderStatus,
    payment_status: (order.payment_status ?? "pending") as ShopPaymentStatus,
    payment_method: String(order.payment_method ?? "maya"),
    maya_reference: typeof order.maya_reference === "string" ? order.maya_reference : null,
    maya_checkout_id: typeof order.maya_checkout_id === "string" ? order.maya_checkout_id : null,
    maya_payment_id: typeof order.maya_payment_id === "string" ? order.maya_payment_id : null,
    maya_payment_status: typeof order.maya_payment_status === "string" ? order.maya_payment_status : null,
    maya_fund_source: typeof order.maya_fund_source === "string" ? order.maya_fund_source : null,
    payment_attempts: Number(order.payment_attempts ?? 0),
    paid_at: typeof order.paid_at === "string" ? order.paid_at : null,
    referral_slug: typeof order.referral_slug === "string" ? order.referral_slug : null,
    referral_doctor_id: typeof order.referral_doctor_id === "string" ? order.referral_doctor_id : null,
    customer_name: String(order.customer_name ?? ""),
    first_name: typeof order.first_name === "string" ? order.first_name : null,
    last_name: typeof order.last_name === "string" ? order.last_name : null,
    email: String(order.email ?? ""),
    mobile: String(order.mobile ?? ""),
    address: String(order.address ?? ""),
    city: String(order.city ?? ""),
    province: String(order.province ?? ""),
    barangay: String(order.barangay ?? ""),
    zip: String(order.zip ?? ""),
    province_code: typeof order.province_code === "string" ? order.province_code : null,
    city_municipality_code: typeof order.city_municipality_code === "string" ? order.city_municipality_code : null,
    barangay_code: typeof order.barangay_code === "string" ? order.barangay_code : null,
    shipping_region: typeof order.shipping_region === "string" ? order.shipping_region : null,
    shipping_fee: shippingFee,
    shipping_weight_grams: Number(order.shipping_weight_grams ?? 0),
    total_amount: totalAmount,
    subtotal,
    items: Array.isArray(order.items) ? (order.items as ShopOrderItem[]) : [],
    admin_notes: typeof order.admin_notes === "string" ? order.admin_notes : null,
    sales_channel: order.sales_channel === "store" ? "store" : "online",
    fulfillment: cleanFulfillment(order),
    created_at: String(order.created_at ?? ""),
    updated_at: String(order.updated_at ?? ""),
  };
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

// ─── Wheel Prizes ───────────────────────────────────────────────────────────

export async function serverAdminListWheelPrizes(adminPassword: string): Promise<WheelPrize[]> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("admin_list_wheel_prizes", {
    p_admin_password: adminPassword,
  });

  if (error) throw error;
  return ((data ?? []) as PrizeRow[]).map(mapWheelPrizeRow);
}

export async function serverAdminSaveWheelPrize(
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

// ─── Doctors ────────────────────────────────────────────────────────────────

export async function serverGetDoctorRegistrations(adminPassword: string): Promise<AdminDoctorRegistration[]> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("admin_list_doctor_registrations", {
    p_admin_password: adminPassword,
  });

  if (error) throw error;

  // code_label isn't in admin_list_doctor_registrations, so read it from the table. Only labelled
  // rows, to stay under PostgREST's row cap. Errors (no column before 20261102000000) mean no labels.
  const { data: labelled } = await supabase.from("doctor_registrations").select("id, code_label").neq("code_label", "");
  const labels = new Map(((labelled ?? []) as { id: string; code_label: string }[]).map((row) => [row.id, row.code_label]));

  return ((data ?? []) as AdminDoctorRegistration[]).map((doctor) =>
    normalizeAdminDoctorRegistration({ ...doctor, code_label: labels.get(doctor.id) ?? "" }),
  );
}

/** A blank partner with just a code; admin fills the details (and email, to sign in) later. */
export async function serverAdminCreatePendingPartner(
  adminPassword: string,
  note = "",
  source = "",
  label = "",
): Promise<{ id: string; partner_code: number; routing_slug: string; label_saved: boolean }> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  const client = supabase;

  // Empty fields are left out so the call still matches the older functions until
  // 20261028000000_partner_code_note_source.sql / 20261102000000_partner_code_label.sql are applied.
  const create = (withLabel: boolean) =>
    client.rpc("admin_create_pending_partner", {
      p_admin_password: adminPassword,
      ...(note ? { p_note: note } : {}),
      ...(source ? { p_source: source } : {}),
      ...(withLabel && label ? { p_label: label } : {}),
    });

  let { data, error } = await create(true);
  let labelSaved = Boolean(label);
  // No p_label yet (label migration not applied): still create the code, without the label.
  if (error && label && error.code === "PGRST202") {
    ({ data, error } = await create(false));
    labelSaved = false;
  }

  if (error) throw error;
  return { ...(Array.isArray(data) ? data[0] : data), label_saved: labelSaved };
}

export async function serverUpdateDoctorRegistration(
  adminPassword: string,
  doctor: AdminDoctorRegistrationUpdate,
): Promise<AdminDoctorRegistration & { label_saved?: boolean }> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("admin_update_doctor_registration", {
    p_admin_password: adminPassword,
    p_doctor_id: doctor.id,
    p_full_name: doctor.full_name,
    p_name_prefix: doctor.name_prefix,
    p_email: doctor.email,
    p_mobile: doctor.mobile,
    p_specialty: doctor.specialty,
    p_practice_location: doctor.practice_location,
  });

  if (error) throw error;

  const updated = {
    ...normalizeAdminDoctorRegistration((Array.isArray(data) ? data[0] : data) as AdminDoctorRegistration),
    ...(await saveCodeFields(doctor)),
  };
  const cleanSlug = doctor.routing_slug?.trim().toLowerCase();
  if (!cleanSlug || cleanSlug === updated.routing_slug) return updated;

  // The slug is the partner's public link (gutguard.ph/<slug>), so it must be routable there.
  if (!PARTNER_SLUG_PATTERN.test(cleanSlug) || RESERVED_PARTNER_SLUGS.has(cleanSlug)) {
    throw new Error("Routing slug must use lowercase letters, numbers and single hyphens, and cannot be a site path.");
  }
  // Partners live in `doctors` on every deployment (sandbox mirrors only the shop), so this
  // goes through the doctors client rather than NEXT_PUBLIC_SHOP_DB_SCHEMA.
  const { error: slugError } = await supabase
    .from("doctor_registrations")
    .update({ routing_slug: cleanSlug })
    .eq("id", doctor.id);
  if (slugError) {
    throw slugError.code === "23505" ? new Error(`The routing slug "${cleanSlug}" is already taken.`) : slugError;
  }
  return { ...updated, routing_slug: cleanSlug };
}

type CodeFields = Pick<AdminDoctorRegistrationUpdate, "id" | "code_note" | "code_source" | "code_label">;

/** Partner codes page: change a code's label, description and where-used without the doctor's details. */
export async function serverUpdatePartnerCodeFields(
  fields: CodeFields,
): Promise<Partial<AdminDoctorRegistration> & { label_saved?: boolean }> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  return saveCodeFields(fields);
}

/**
 * Partner Codes fields (label, description, where the QR is used), editable after the code is
 * made. Written to the table directly, like routing_slug, so admin_update_doctor_registration
 * (also recreated by the TikTok migrations) stays as it is.
 */
async function saveCodeFields(
  doctor: CodeFields,
): Promise<Partial<AdminDoctorRegistration> & { label_saved?: boolean }> {
  const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : undefined);
  const fields: Record<string, string> = {};
  for (const [key, max] of [["code_note", 200], ["code_source", 120], ["code_label", 40]] as const) {
    const value = text(doctor[key], max);
    if (value !== undefined) fields[key] = value;
  }
  if (Object.keys(fields).length === 0) return {};

  const save = (values: Record<string, string>) => supabase!.from("doctor_registrations").update(values).eq("id", doctor.id);
  const { error } = await save(fields);
  if (!error) return fields;

  // PGRST204: no code_label column until 20261102000000_partner_code_label.sql. Save the rest.
  if (error.code !== "PGRST204" || !("code_label" in fields)) throw error;
  const withoutLabel = { ...fields };
  delete withoutLabel.code_label;
  if (Object.keys(withoutLabel).length > 0) {
    const retry = await save(withoutLabel);
    if (retry.error) throw retry.error;
  }
  return { ...withoutLabel, label_saved: false };
}

export async function serverAdminUpgradeToMainStore(
  adminPassword: string,
  partnerId: string,
  note?: string,
): Promise<{ success: boolean; descendants_moved: number }> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("admin_upgrade_to_main_store", {
    p_admin_password: adminPassword,
    p_partner_id: partnerId,
    p_note: note || null,
  });

  if (error) throw error;
  return data as { success: boolean; descendants_moved: number };
}

export async function serverAdminTransferStore(
  adminPassword: string,
  partnerId: string,
  newUplineId: string,
  note?: string,
): Promise<{ success: boolean; main_store_id: string; points_moved: number; sandbox_points_moved: number }> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("admin_transfer_store", {
    p_admin_password: adminPassword,
    p_partner_id: partnerId,
    p_new_upline_id: newUplineId,
    p_note: note || null,
  });

  if (error) throw error;
  return data as { success: boolean; main_store_id: string; points_moved: number; sandbox_points_moved: number };
}

// Orders and points live per schema, so these go through supabaseShop like the order RPCs.
export async function serverAdminListUnclaimedPassup(
  adminPassword: string,
): Promise<Array<{ store_id: string; orders: number; points: number }>> {
  if (!isSupabaseConfigured || !supabaseShop) throw new Error("Supabase is not configured.");

  const { data, error } = await supabaseShop.rpc("admin_list_unclaimed_passup", {
    p_admin_password: adminPassword,
  });

  if (error) throw error;
  return (data ?? []) as Array<{ store_id: string; orders: number; points: number }>;
}

export async function serverAdminAssignUnclaimedPassup(
  adminPassword: string,
  storeId: string,
  partnerId: string,
  note?: string,
): Promise<{ success: boolean; orders: number; points: number }> {
  if (!isSupabaseConfigured || !supabaseShop) throw new Error("Supabase is not configured.");

  const { data, error } = await supabaseShop.rpc("admin_assign_unclaimed_passup", {
    p_admin_password: adminPassword,
    p_store_id: storeId,
    p_partner_id: partnerId,
    p_note: note || null,
  });

  if (error) throw error;
  return data as { success: boolean; orders: number; points: number };
}

export type AdminWithdrawal = PartnerWithdrawal & { partner_id: string; partner_name: string; partner_email: string; partner_mobile: string };

// Withdrawals live per schema, like the rebates they are paid from.
export async function serverAdminListWithdrawals(adminPassword: string): Promise<AdminWithdrawal[]> {
  if (!isSupabaseConfigured || !supabaseShop) throw new Error("Supabase is not configured.");

  const { data, error } = await supabaseShop.rpc("admin_list_partner_withdrawals", { p_admin_password: adminPassword });
  if (error) throw error;
  return (data ?? []) as AdminWithdrawal[];
}

export async function serverAdminProcessWithdrawal(
  adminPassword: string,
  id: string,
  status: "approved" | "rejected",
  reference: string,
  note: string,
): Promise<PartnerWithdrawal> {
  if (!isSupabaseConfigured || !supabaseShop) throw new Error("Supabase is not configured.");

  const { data, error } = await supabaseShop.rpc("admin_process_partner_withdrawal", {
    p_admin_password: adminPassword,
    p_id: id,
    p_status: status,
    p_reference: reference,
    p_note: note,
  });
  if (error) throw error;
  return data as PartnerWithdrawal;
}

export async function serverAdminToggleReferralQr(
  adminPassword: string,
  partnerId: string,
  enabled: boolean,
): Promise<{ success: boolean; referral_qr_enabled: boolean }> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("admin_toggle_referral_qr", {
    p_admin_password: adminPassword,
    p_partner_id: partnerId,
    p_enabled: enabled,
  });

  if (error) throw error;
  return data as { success: boolean; referral_qr_enabled: boolean };
}

export async function serverAdminPromotePartner(
  adminPassword: string,
  partnerId: string,
  note?: string,
): Promise<{ success: boolean; store_type: string }> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("admin_promote_partner", {
    p_admin_password: adminPassword,
    p_partner_id: partnerId,
    p_note: note || null,
  });

  if (error) throw error;
  return data as { success: boolean; store_type: string };
}

export async function serverSetDoctorShopProtocol(
  adminPassword: string,
  doctorId: string,
  show: boolean,
): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("admin_set_doctor_shop_protocol", {
    p_admin_password: adminPassword,
    p_doctor_id: doctorId,
    p_show: show,
  });

  if (error) throw error;
  return data === true;
}

// ─── Newsletter ─────────────────────────────────────────────────────────────

export async function serverGetNewsletterSendHistory(adminPassword: string): Promise<NewsletterSendHistory[]> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("admin_list_newsletter_sends", {
    p_admin_password: adminPassword,
  });

  if (error) throw error;
  return (data ?? []) as NewsletterSendHistory[];
}

export async function serverSendNewsletter(
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

// ─── SMS ────────────────────────────────────────────────────────────────────

export async function serverGetSmsBlastHistory(adminPassword: string): Promise<SmsSendHistory[]> {
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

export async function serverSendSmsBlast(
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

// ─── Shop Orders ────────────────────────────────────────────────────────────

export async function serverAdminListShopOrders(adminPassword: string): Promise<ShopOrder[]> {
  if (!isSupabaseConfigured || !supabaseShop) throw new Error("Supabase is not configured.");

  const { data, error } = await supabaseShop.rpc("admin_list_shop_orders", {
    p_admin_password: adminPassword,
  });

  if (error) throw error;
  return ((data ?? []) as unknown[]).map(normalizeShopOrder);
}

export async function serverAdminGetShopOrder(adminPassword: string, orderId: string): Promise<ShopOrder> {
  if (!isSupabaseConfigured || !supabaseShop) throw new Error("Supabase is not configured.");

  const { data, error } = await supabaseShop.rpc("admin_get_shop_order", {
    p_admin_password: adminPassword,
    p_order_id: orderId,
  });

  if (error) throw error;
  return normalizeShopOrder(Array.isArray(data) ? data[0] : data);
}

export async function serverAdminUpdateShopOrder(
  adminPassword: string,
  update: ShopOrderAdminUpdate,
): Promise<ShopOrder> {
  if (!isSupabaseConfigured || !supabaseShop) throw new Error("Supabase is not configured.");

  const { data, error } = await supabaseShop.rpc("admin_update_shop_order", {
    p_admin_password: adminPassword,
    p_order_id: update.id,
    p_status: update.status,
    p_payment_status: update.paymentStatus,
    p_maya_reference: update.mayaReference,
    p_admin_notes: update.adminNotes,
  });

  if (error) throw error;
  const saved = normalizeShopOrder(Array.isArray(data) ? data[0] : data);
  if (!update.fulfillment && !update.salesChannel) return saved;

  // Fulfilment fields and the sales channel have no RPC parameters; the RPC above already
  // checked the admin password, so the service-role client writes them directly.
  const { data: extra, error: extraError } = await supabaseShop
    .from("shop_orders")
    .update({
      ...(update.fulfillment ? cleanFulfillment(update.fulfillment) : {}),
      ...(update.salesChannel ? { sales_channel: update.salesChannel } : {}),
    })
    .eq("id", saved.id)
    .select("*")
    .single();
  if (extraError) throw extraError;
  return normalizeShopOrder(extra);
}

// ─── Sequence ───────────────────────────────────────────────────────────────

export async function serverGetSequenceSteps(adminPassword: string): Promise<SequenceStep[]> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.functions.invoke("manage-sequence", {
    body: { action: "get-steps", adminPassword },
  });
  if (error) throw error;
  return (data as { steps: SequenceStep[] }).steps;
}

export async function serverUpsertSequenceStep(
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

export async function serverDeleteSequenceStep(adminPassword: string, stepId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.functions.invoke("manage-sequence", {
    body: { action: "delete-step", adminPassword, stepId },
  });
  if (error) throw error;
}

export async function serverReorderSequenceSteps(adminPassword: string, stepIds: string[]): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.functions.invoke("manage-sequence", {
    body: { action: "reorder-steps", adminPassword, stepIds },
  });
  if (error) throw error;
}

export async function serverGetSequenceProgress(
  adminPassword: string,
): Promise<{ progress: SequenceProgress[]; totalSteps: number }> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.functions.invoke("manage-sequence", {
    body: { action: "get-progress", adminPassword },
  });
  if (error) throw error;
  return data as { progress: SequenceProgress[]; totalSteps: number };
}

export async function serverResendSequenceStep(doctorId: string, stepNumber: number): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.functions.invoke("send-sequence-step", { body: { doctorId, stepNumber } });
  if (error) throw error;
  if (data && data.sent === false) throw new Error(data.reason || "Step was not sent.");
}

// ─── Registration Email Settings ───────────────────────────────────────────

export async function serverGetRegistrationEmailSettings(adminPassword: string, templateKind = "registration"): Promise<RegistrationEmailSettings> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.functions.invoke("registration-email-settings", {
    body: { action: "get", adminPassword, templateKind },
  });

  if (error) throw error;
  return (data as { settings: RegistrationEmailSettings }).settings;
}

export async function serverSaveRegistrationEmailSettings(
  adminPassword: string,
  settings: RegistrationEmailSettings,
  templateKind = "registration",
): Promise<RegistrationEmailSettings> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.functions.invoke("registration-email-settings", {
    body: { action: "save", adminPassword, settings, templateKind },
  });

  if (error) throw error;
  return (data as { settings: RegistrationEmailSettings }).settings;
}

export async function serverSendRegistrationEmailTest(
  adminPassword: string,
  testEmail: string,
  templateKind = "registration",
): Promise<{ sent: boolean; resendId?: string }> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.functions.invoke("registration-email-settings", {
    body: { action: "test", adminPassword, testEmail, templateKind },
  });

  if (error) throw error;
  return data as { sent: boolean; resendId?: string };
}

// ─── Testimonials ───────────────────────────────────────────────────────────

export async function serverAdminListTestimonials(
  adminPassword: string,
  status?: TestimonialStatus,
): Promise<AdminTestimonial[]> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("admin_list_testimonials", {
    p_admin_password: adminPassword,
    p_status: status ?? null,
  });

  if (error) throw error;
  return (data ?? []) as AdminTestimonial[];
}

export async function serverAdminReviewTestimonial(
  adminPassword: string,
  input: { id: string; status: TestimonialStatus; featured?: boolean; reviewNote?: string },
): Promise<AdminTestimonial> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("admin_review_testimonial", {
    p_admin_password: adminPassword,
    p_id: input.id,
    p_status: input.status,
    p_featured: input.featured ?? false,
    p_review_note: input.reviewNote ?? "",
  });

  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as AdminTestimonial;
}
