import { PRIZES } from "@/lib/constants";
import { pickPrizeIndex } from "@/lib/prizes";
import { isSupabaseConfigured, supabase, supabaseShop, SHOP_SCHEMA } from "@/lib/supabase";
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

export type ShopOrderStatus =
  | "pending_payment"
  | "payment_review"
  | "paid"
  | "confirmed"
  | "cancelled"
  | "fulfilled";

export type ShopPaymentStatus = "pending" | "review" | "paid" | "failed" | "refunded";

export type ShopOrderItem = {
  id: string;
  name: string;
  caps: number;
  qty: number;
  price: number;
};

export type ShopOrderInput = {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  address: string;
  city: string;
  province: string;
  barangay: string;
  zip: string;
  provinceCode: string;
  cityMunicipalityCode: string;
  barangayCode: string;
  shippingRegion: string;
  shippingFee: number;
  shippingWeightGrams: number;
  totalAmount: number;
  items: ShopOrderItem[];
  subtotal: number;
  paymentMethod: string;
  referralSlug: string;
};

export type PublicShopOrder = {
  order_code: string;
  order_id: string;
  status: ShopOrderStatus;
  payment_status: ShopPaymentStatus;
  payment_attempts: number;
  maya_reference: string | null;
  maya_fund_source: string | null;
  first_name: string;
  email_masked: string;
  address: string;
  barangay: string;
  city: string;
  province: string;
  zip: string;
  shipping_region: string | null;
  shipping_fee: number;
  subtotal: number;
  total_amount: number;
  items: ShopOrderItem[];
  created_at: string;
  paid_at: string | null;
};

export type ShopOrder = {
  id: string;
  order_code: string;
  status: ShopOrderStatus;
  payment_status: ShopPaymentStatus;
  payment_method: string;
  maya_reference: string | null;
  maya_checkout_id: string | null;
  maya_payment_id: string | null;
  maya_payment_status: string | null;
  maya_fund_source: string | null;
  payment_attempts: number;
  paid_at: string | null;
  /** What the referral link claimed - present even when the referral was rejected. */
  referral_slug: string | null;
  /** Set only for a valid, non-self referral. Null here means "not attributable". */
  referral_doctor_id: string | null;
  customer_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  mobile: string;
  address: string;
  city: string;
  province: string;
  barangay: string;
  zip: string;
  province_code: string | null;
  city_municipality_code: string | null;
  barangay_code: string | null;
  shipping_region: string | null;
  shipping_fee: number;
  shipping_weight_grams: number;
  total_amount: number;
  subtotal: number;
  items: ShopOrderItem[];
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ShopOrderAdminUpdate = {
  id: string;
  status: ShopOrderStatus;
  paymentStatus: ShopPaymentStatus;
  mayaReference: string;
  adminNotes: string;
};

/** One attributed order as a partner is allowed to see it - no buyer contact or address. */
export type PartnerOrder = {
  order_code: string;
  created_at: string;
  status: ShopOrderStatus;
  payment_status: ShopPaymentStatus;
  total_amount: number;
  buyer_first_name: string;
  city: string;
  province: string;
};

export type PartnerDashboard = {
  partner: { full_name: string; routing_slug: string; joined_at: string };
  clicks: { total: number; last_30_days: number };
  /** paid_amount is gross order value, not commission. */
  totals: { orders: number; paid_orders: number; paid_amount: number };
  orders: PartnerOrder[];
};

export type TikTokOrderTimeMode = "create_time" | "update_time";

export type TikTokOrdersFilters = {
  timeMode: TikTokOrderTimeMode;
  startTime?: number;
  endTime?: number;
  orderStatus?: string;
  pageSize: number;
  pageToken?: string;
};

export type TikTokOrderSummary = {
  id: string;
  status: string;
  createTime: string;
  updateTime: string;
  buyerEmail: string;
  deliveryOptionName: string;
  shippingProvider: string;
  trackingNumber: string;
  paymentAmount: string;
  currency: string;
  buyerMessage?: string;
  commercePlatform?: string;
  fulfillmentType?: string;
  isReplacementOrder?: boolean;
  isSampleOrder?: boolean;
  lineItemCount?: number;
};

export type TikTokAdminAction =
  | "get-order-list"
  | "get-order-detail"
  | "get-price-detail"
  | "add-external-order-reference"
  | "get-external-order-references"
  | "search-order-by-external-reference"
  | "update-blind-box-opening-results"
  | "raw-api-request";

export type TikTokDebugMetadata = {
  method: string;
  path: string;
  query: Record<string, unknown>;
  body: Record<string, unknown>;
  baseUrl: string;
  tokenRefreshed?: boolean;
  requestedAt: string;
};

export type TikTokRawResponse = {
  debug: TikTokDebugMetadata;
  raw: unknown;
};

export type TikTokOrdersResponse = {
  orders: TikTokOrderSummary[];
  nextPageToken: string;
  totalCount: number | null;
  debug: TikTokDebugMetadata;
  raw: unknown;
};

export type TikTokOrderDetailResponse = TikTokRawResponse & {
  order: {
    summary: TikTokOrderSummary;
    lineItems: Array<{
      id: string;
      productName?: string;
      skuName?: string;
      quantity?: number;
      displayStatus?: string;
      price?: string;
      currency?: string;
    }>;
    packages: Array<{
      id: string;
      deliveryOptionName?: string;
      shippingProvider?: string;
      trackingNumber?: string;
    }>;
    payment: {
      currency?: string;
      totalAmount?: string;
      shippingFee?: string;
      subTotal?: string;
    };
  };
};

export type TikTokPriceDetailResponse = TikTokRawResponse & {
  price: {
    orderId: string;
    currency: string;
    totals: Array<{ label: string; amount: string }>;
    lineItems: Array<{
      id: string;
      skuName?: string;
      productName?: string;
      quantity?: number;
      price?: string;
      currency?: string;
    }>;
  };
};

export type TikTokReferenceResponse = TikTokRawResponse & {
  references: Array<{
    orderId?: string;
    externalReference?: string;
    createdAt?: string;
    updatedAt?: string;
  }>;
};

export type TikTokRawApiResponse = TikTokRawResponse;

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

type RegistrationEmailResponse = {
  sent?: boolean;
  skipped?: boolean;
  reason?: string;
  resendId?: string;
};

export async function sendRegistrationEmail(registrationId: string) {
  if (!isSupabaseConfigured || !supabase || registrationId.startsWith("local-")) {
    throw new Error("Registration email is unavailable because Supabase is not configured.");
  }

  const { data, error } = await supabase.functions.invoke<RegistrationEmailResponse>("send-proposal", {
    body: { registrationId },
  });

  if (error) throw error;
  if (!data?.sent) throw new Error(data?.reason || "The registration email was not sent.");
  return data;
}

/** @deprecated Use sendRegistrationEmail. */
export const sendProposalEmail = sendRegistrationEmail;

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

export async function createShopOrder(payload: ShopOrderInput): Promise<ShopOrder> {
  if (!isSupabaseConfigured || !supabaseShop) throw new Error("Supabase is not configured.");

  const { data, error } = await supabaseShop.rpc("create_shop_order", {
    p_first_name: payload.firstName,
    p_last_name: payload.lastName,
    p_email: payload.email,
    p_mobile: payload.mobile,
    p_address: payload.address,
    p_city: payload.city,
    p_province: payload.province,
    p_barangay: payload.barangay,
    p_zip: payload.zip,
    p_province_code: payload.provinceCode,
    p_city_municipality_code: payload.cityMunicipalityCode,
    p_barangay_code: payload.barangayCode,
    p_shipping_region: payload.shippingRegion,
    p_shipping_fee: payload.shippingFee,
    p_shipping_weight_grams: payload.shippingWeightGrams,
    p_total_amount: payload.totalAmount,
    p_items: payload.items,
    p_subtotal: payload.subtotal,
    p_payment_method: payload.paymentMethod,
    p_referral_slug: payload.referralSlug,
  });

  if (error) throw error;
  return normalizeShopOrder(Array.isArray(data) ? data[0] : data);
}

export async function sendShopOrderEmail(orderId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase.functions.invoke("send-shop-order-email", {
    body: { orderId, schema: SHOP_SCHEMA },
  });

  if (error) throw new Error(await getSupabaseFunctionErrorMessage(error));
}

/**
 * Starts a Maya Checkout session server-side. The route re-verifies the amount against
 * the catalog, so the browser never decides what gets charged.
 */
export async function startMayaCheckout(orderId: string): Promise<{ redirectUrl?: string; orderUrl: string; alreadyPaid?: boolean }> {
  const response = await fetch("/api/maya/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error ?? "Maya checkout could not be started.");
  }

  return body as { redirectUrl?: string; orderUrl: string; alreadyPaid?: boolean };
}

/**
 * Asks the server to re-check this order's payment directly with Maya. Used when the
 * webhook has not landed, so a paid order never stays stuck on "awaiting payment".
 */
export async function reconcileMayaPayment(orderCode: string): Promise<{ paymentStatus: string; changed: boolean }> {
  const response = await fetch("/api/maya/reconcile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderCode }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? "Payment could not be verified.");
  return body as { paymentStatus: string; changed: boolean };
}

export async function getPublicShopOrder(orderCode: string): Promise<PublicShopOrder | null> {
  if (!isSupabaseConfigured || !supabaseShop) throw new Error("Supabase is not configured.");

  const { data, error } = await supabaseShop.rpc("get_shop_order_public", { p_order_code: orderCode });
  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null | undefined;
  if (!row) return null;

  const subtotal = Number(row.subtotal ?? 0);
  const shippingFee = Number(row.shipping_fee ?? 0);

  return {
    order_code: String(row.order_code ?? ""),
    order_id: String(row.order_id ?? ""),
    status: (row.status ?? "pending_payment") as ShopOrderStatus,
    payment_status: (row.payment_status ?? "pending") as ShopPaymentStatus,
    payment_attempts: Number(row.payment_attempts ?? 0),
    maya_reference: typeof row.maya_reference === "string" ? row.maya_reference : null,
    maya_fund_source: typeof row.maya_fund_source === "string" ? row.maya_fund_source : null,
    first_name: String(row.first_name ?? ""),
    email_masked: String(row.email_masked ?? ""),
    address: String(row.address ?? ""),
    barangay: String(row.barangay ?? ""),
    city: String(row.city ?? ""),
    province: String(row.province ?? ""),
    zip: String(row.zip ?? ""),
    shipping_region: typeof row.shipping_region === "string" ? row.shipping_region : null,
    shipping_fee: shippingFee,
    subtotal,
    total_amount: Number(row.total_amount ?? 0) || subtotal + shippingFee,
    items: Array.isArray(row.items) ? (row.items as ShopOrderItem[]) : [],
    created_at: String(row.created_at ?? ""),
    paid_at: typeof row.paid_at === "string" ? row.paid_at : null,
  };
}

/**
 * Partner sign-in, step 1: email a 6-digit code.
 *
 * shouldCreateUser stays true even though only registered partners may see data. Partner
 * rows predate this login and have no auth.users entry, so `false` would lock every one of
 * them out permanently. Access is gated by partner_dashboard(), which checks the verified
 * address against doctor_registrations - and leaving account creation open means the sign-in
 * form cannot be used to test whether an address is a registered partner.
 *
 * Requires {{ .Token }} in the Supabase "Magic Link" email template, or the mail arrives
 * with a link and no code to type.
 */
export async function sendPartnerOtp(email: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  });

  if (error) throw error;
}

/** Partner sign-in, step 2: exchange the code for a session. */
export async function verifyPartnerOtp(email: string, token: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase || !supabaseShop) throw new Error("Supabase is not configured.");

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedToken = token.trim();

  // Supabase normally verifies a numeric email OTP with type "email". On a partner's
  // first-ever login, however, signInWithOtp creates the auth user and sends the Confirm
  // signup template; some hosted Auth versions classify that token as "signup" (and older
  // passwordless flows as "magiclink"). Try the canonical type first, then the two exact
  // email-flow variants. A failed verification does not consume the token.
  let session = null;
  let lastError: Error | null = null;

  for (const type of ["email", "signup", "magiclink"] as const) {
    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: normalizedToken,
      type,
    });

    if (!error) {
      session = data.session;
      lastError = null;
      break;
    }

    lastError = error;
  }

  if (lastError) throw lastError;

  // supabaseShop is a second createClient (see lib/supabase.ts) and was built before this
  // session existed, so it is still anonymous in this tab until it is handed the session.
  // Without this the first dashboard read fails and only starts working after a reload.
  if (session) await supabaseShop.auth.setSession(session);
}

export async function signOutPartner(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.auth.signOut();
}

/** True when a partner already has a live session, so the login form can be skipped. */
export async function hasPartnerSession(): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !supabaseShop) return false;

  const { data } = await supabase.auth.getSession();
  if (!data.session) return false;

  await supabaseShop.auth.setSession(data.session);
  return true;
}

export async function getPartnerDashboard(): Promise<PartnerDashboard> {
  if (!isSupabaseConfigured || !supabaseShop) throw new Error("Supabase is not configured.");

  const { data, error } = await supabaseShop.rpc("partner_dashboard");
  if (error) throw error;

  const row = (data ?? {}) as Record<string, unknown>;
  const partner = (row.partner ?? {}) as Record<string, unknown>;
  const clicks = (row.clicks ?? {}) as Record<string, unknown>;
  const totals = (row.totals ?? {}) as Record<string, unknown>;

  return {
    partner: {
      full_name: String(partner.full_name ?? ""),
      routing_slug: String(partner.routing_slug ?? ""),
      joined_at: String(partner.joined_at ?? ""),
    },
    clicks: {
      total: Number(clicks.total ?? 0),
      last_30_days: Number(clicks.last_30_days ?? 0),
    },
    totals: {
      orders: Number(totals.orders ?? 0),
      paid_orders: Number(totals.paid_orders ?? 0),
      paid_amount: Number(totals.paid_amount ?? 0),
    },
    orders: (Array.isArray(row.orders) ? row.orders : []).map((entry) => {
      const order = (entry ?? {}) as Record<string, unknown>;
      return {
        order_code: String(order.order_code ?? ""),
        created_at: String(order.created_at ?? ""),
        status: (order.status ?? "pending_payment") as ShopOrderStatus,
        payment_status: (order.payment_status ?? "pending") as ShopPaymentStatus,
        total_amount: Number(order.total_amount ?? 0),
        buyer_first_name: String(order.buyer_first_name ?? ""),
        city: String(order.city ?? ""),
        province: String(order.province ?? ""),
      };
    }),
  };
}

export async function adminListShopOrders(adminPassword: string): Promise<ShopOrder[]> {
  if (!isSupabaseConfigured || !supabaseShop) throw new Error("Supabase is not configured.");

  const { data, error } = await supabaseShop.rpc("admin_list_shop_orders", {
    p_admin_password: adminPassword,
  });

  if (error) throw error;
  return ((data ?? []) as unknown[]).map(normalizeShopOrder);
}

export async function adminGetShopOrder(adminPassword: string, orderId: string): Promise<ShopOrder> {
  if (!isSupabaseConfigured || !supabaseShop) throw new Error("Supabase is not configured.");

  const { data, error } = await supabaseShop.rpc("admin_get_shop_order", {
    p_admin_password: adminPassword,
    p_order_id: orderId,
  });

  if (error) throw error;
  return normalizeShopOrder(Array.isArray(data) ? data[0] : data);
}

export async function adminUpdateShopOrder(
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
  return normalizeShopOrder(Array.isArray(data) ? data[0] : data);
}

// ─── Email Sequence ────────────────────────────────────────────────────────

export async function getTikTokOrders(
  adminPassword: string,
  filters: TikTokOrdersFilters,
): Promise<TikTokOrdersResponse> {
  return callTikTokAdminApi<TikTokOrdersResponse>(adminPassword, "get-order-list", filters);
}

export async function getTikTokOrderDetail(
  adminPassword: string,
  orderId: string,
): Promise<TikTokOrderDetailResponse> {
  return callTikTokAdminApi<TikTokOrderDetailResponse>(adminPassword, "get-order-detail", { orderId });
}

export async function getTikTokPriceDetail(
  adminPassword: string,
  orderId: string,
): Promise<TikTokPriceDetailResponse> {
  return callTikTokAdminApi<TikTokPriceDetailResponse>(adminPassword, "get-price-detail", { orderId });
}

export async function addTikTokExternalOrderReference(
  adminPassword: string,
  orderId: string,
  externalOrderReference: string,
): Promise<TikTokReferenceResponse> {
  return callTikTokAdminApi<TikTokReferenceResponse>(adminPassword, "add-external-order-reference", {
    orderId,
    externalOrderReference,
  });
}

export async function getTikTokExternalOrderReferences(
  adminPassword: string,
  orderId: string,
): Promise<TikTokReferenceResponse> {
  return callTikTokAdminApi<TikTokReferenceResponse>(adminPassword, "get-external-order-references", { orderId });
}

export async function searchTikTokOrderByExternalReference(
  adminPassword: string,
  externalOrderReference: string,
): Promise<TikTokReferenceResponse> {
  return callTikTokAdminApi<TikTokReferenceResponse>(adminPassword, "search-order-by-external-reference", {
    externalOrderReference,
  });
}

export async function sendTikTokRawApiRequest(
  adminPassword: string,
  payload: {
    method: "GET" | "POST";
    path: string;
    query?: Record<string, string>;
    body?: Record<string, unknown>;
  },
): Promise<TikTokRawApiResponse> {
  return callTikTokAdminApi<TikTokRawApiResponse>(adminPassword, "raw-api-request", payload);
}

export async function callTikTokAdminApi<TResponse>(
  adminPassword: string,
  action: TikTokAdminAction,
  payload: Record<string, unknown>,
): Promise<TResponse> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.functions.invoke("tiktok-shop-admin", {
    body: { adminPassword, action, payload },
  });

  if (error) throw new Error(await getSupabaseFunctionErrorMessage(error));
  return data as TResponse;
}

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

type SequenceStepSendResponse = {
  sent?: boolean;
  reason?: string;
  sendId?: string;
  step?: number;
};

export async function enrollDoctorInSequence(doctorId: string): Promise<SequenceStepSendResponse> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.functions.invoke<SequenceStepSendResponse>("send-sequence-step", {
    body: { doctorId, stepNumber: 1 },
  });
  if (error) throw error;
  if (!data?.sent) throw new Error(data?.reason || "Drip Campaign Step 1 was not sent.");
  return data;
}

export async function resendSequenceStep(doctorId: string, stepNumber: number): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.functions.invoke("send-sequence-step", {
    body: { doctorId, stepNumber },
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
    created_at: String(order.created_at ?? ""),
    updated_at: String(order.updated_at ?? ""),
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
