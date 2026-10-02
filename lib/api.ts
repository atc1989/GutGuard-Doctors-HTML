import { PRIZES } from "@/lib/constants";
import { pickPrizeIndex } from "@/lib/prizes";
import { isSupabaseConfigured, supabase, supabaseShop, SHOP_SCHEMA } from "@/lib/supabase";
import { checkImageFile, TESTIMONIAL_BUCKET } from "@/lib/testimonials";
import type { AdminTestimonial, PublicTestimonial, TestimonialStatus } from "@/lib/testimonials";
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

export type AdminWheelPrize = {
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

export type StoreType = "affiliate" | "lifestyle" | "main";

export type AdminDoctorRegistration = {
  id: string;
  full_name: string;
  name_prefix: string;
  email: string;
  mobile: string;
  tiktok_username: string;
  routing_slug: string;
  redirect_url: string;
  specialty: string;
  practice_location: string;
  store_type?: StoreType;
  referral_qr_enabled?: boolean;
  main_store_id?: string | null;
  promoted_at?: string | null;
  promoted_by?: string | null;
  created_at: string;
  prize_label?: string | null;
  prize_claimed_at?: string | null;
};

export type AdminDoctorRegistrationUpdate = {
  id: string;
  full_name: string;
  name_prefix: string;
  email: string;
  mobile: string;
  tiktok_username: string;
  routing_slug?: string;
  redirect_url: string;
  specialty: string;
  practice_location: string;
};

export type NewsletterSendHistory = {
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

export type SmsSendHistory = {
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

export type NewsletterResponse = {
  sent: number;
  failed: number;
  skipped: number;
  results: NewsletterSendResult[];
};

export type SmsBlastResponse = {
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
  /** Buyer contact, shown in full to the partner. See 20260924000000 for the scope caveat. */
  buyer_name: string;
  buyer_email: string;
  buyer_mobile: string;
  address: string;
  barangay: string;
  zip: string;
  city: string;
  province: string;
  source_type: "direct" | "referred";
  source_partner_name: string;
  source_partner_slug: string;
};

export type ReferredPartner = {
  full_name: string;
  routing_slug: string;
  specialty: string;
  practice_location: string;
  store_type?: StoreType;
  referral_qr_enabled?: boolean;
  joined_at: string;
  orders: number;
  paid_order_value: number;
};

export type PartnerOrderScope = "all" | "direct" | "referred";

export type PartnerDashboardQuery = {
  scope?: PartnerOrderScope;
  status?: string;
  limit?: number;
  offset?: number;
  dateFrom?: string;
  dateTo?: string;
  sort?: "newest" | "oldest";
};

export type PartnerDashboard = {
  partner: {
    id: string;
    full_name: string;
    routing_slug: string;
    store_type?: StoreType;
    referral_qr_enabled?: boolean;
    main_store_id?: string | null;
    promoted_at?: string | null;
    promoted_by?: string | null;
    joined_at: string;
  };
  clicks: { total: number; last_30_days: number };
  /** paid_amount is gross order value, not commission. */
  totals: {
    orders: number;
    paid_orders: number;
    paid_amount: number;
    direct_orders: number;
    referred_orders: number;
    referred_partners: number;
    direct_paid_amount: number;
    referred_paid_amount: number;
  };
  points: {
    direct_points: number;
    referred_points: number;
    current_cycle: number;
    points_in_cycle: number;
    lifetime_points: number;
    own_points: number;
    passup_points: number;
    passed_up_to_upline_points: number;
  };
  rebates: Array<{
    cycle_number: number;
    milestone_pts: number;
    rebate_amount: number;
    status: string;
    created_at: string;
  }>;
  point_sources?: Array<{
    order_code: string;
    points: number;
    depth: number;
    source_partner: string;
    created_at: string;
  }>;
  orders: PartnerOrder[];
  orders_page: { total: number; limit: number; offset: number; has_more: boolean };
  referred_partners: ReferredPartner[];
};

export type MainStoreSummary = {
  id: string;
  full_name: string;
  routing_slug: string;
  email: string;
  store_type: StoreType;
  referral_qr_enabled: boolean;
};

export type MainStoreDashboard = {
  main_store: MainStoreSummary;
  lifestyle_count: number;
  affiliate_count: number;
  total_orders: number;
  total_revenue: number;
  combined_points: number;
  own_points: number;
  passup_points: number;
};

export type MainStoreOrder = {
  order_code: string;
  created_at: string;
  status: ShopOrderStatus;
  payment_status: ShopPaymentStatus;
  total_amount: number;
  buyer_name: string;
  store_id: string;
  store_name: string;
  store_type: StoreType;
  store_slug: string;
};

export type MainStoreChildStore = {
  id: string;
  full_name: string;
  store_type: StoreType;
  routing_slug: string;
  specialty: string;
  practice_location: string;
  created_at: string;
  referral_qr_enabled: boolean;
  orders_count: number;
  revenue: number;
  points: number;
};

export type MainStoreReports = {
  total_orders: number;
  orders: MainStoreOrder[];
  stores: MainStoreChildStore[];
};

export type PartnerInvitation = {
  routing_slug: string;
  full_name: string;
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
      p_name_prefix: payload.namePrefix,
      p_email: payload.email,
      p_mobile: payload.mobile,
      p_tiktok_username: payload.tiktokUsername,
      p_specialty: payload.specialty,
      p_practice_location: payload.location,
      p_referrer_slug: payload.referrerSlug || null,
    });

    if (error) throw new Error(`Registration failed: ${error.message}`);

    const registration = {
      id: data as string,
      ...payload,
    };

    if (payload.referrerSlug) {
      void notifyPartnerReferral(registration.id);
    }

    return registration;
  }

  return {
    id: `local-${Date.now()}`,
    ...payload,
  };
}

export async function getPartnerInvitation(slug: string): Promise<PartnerInvitation | null> {
  const clean = slug.trim().toLowerCase();
  if (!clean || !isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase.rpc("get_partner_invitation", { p_slug: clean });
  if (error) return null;

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  const routing_slug = String(row?.routing_slug ?? "").trim();
  const full_name = String(row?.full_name ?? "").trim();
  if (!routing_slug) return null;

  return { routing_slug, full_name };
}

export async function sendPartnerReferralNotification(registrationId: string) {
  return notifyPartnerReferral(registrationId);
}

async function notifyPartnerReferral(registrationId: string) {
  if (!isSupabaseConfigured || !supabase || registrationId.startsWith("local-")) return;

  try {
    await supabase.functions.invoke("send-partner-referral-notification", {
      body: { registrationId },
    });
  } catch {
    // Registration already succeeded. The referrer email is best-effort.
  }
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

export async function adminLogin(password: string): Promise<boolean> {
  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Invalid admin password.");
  }
  return true;
}

export async function adminLogout(): Promise<void> {
  await fetch("/api/admin/logout", { method: "POST" });
}

export async function checkAdminSession(): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/session");
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.authenticated);
  } catch {
    return false;
  }
}

export async function adminListWheelPrizes(_adminPassword?: string): Promise<WheelPrize[]> {
  const res = await fetch("/api/admin/wheel/prizes");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to load wheel prizes.");
  }
  const data = await res.json();
  return ((data.prizes ?? []) as PrizeRow[]).map(mapWheelPrizeRow);
}

export async function adminSaveWheelPrize(
  _adminPassword?: string,
  prize?: WheelPrizeInput,
): Promise<WheelPrize> {
  const res = await fetch("/api/admin/wheel/prizes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prize),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to save wheel prize.");
  }
  const data = await res.json();
  return mapWheelPrizeRow((Array.isArray(data.prize) ? data.prize[0] : data.prize) as PrizeRow);
}

export async function getWheelPrizes(adminPassword?: string): Promise<AdminWheelPrize[]> {
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

export async function getDoctorRegistrations(_adminPassword?: string): Promise<AdminDoctorRegistration[]> {
  const res = await fetch("/api/admin/doctors");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to load doctor registrations.");
  }
  const data = await res.json();
  return ((data.doctors ?? []) as AdminDoctorRegistration[]).map(normalizeAdminDoctorRegistration);
}

/**
 * Admin "log in as this doctor": returns a one-time magic link that opens the partner
 * portal as that partner. The link is not emailed - open it in a new tab (or a private
 * window, since it replaces any partner session already held by this browser profile).
 */
export async function adminImpersonateDoctor(
  _adminPassword?: string,
  email?: string,
): Promise<{ actionLink: string; fullName: string }> {
  const res = await fetch("/api/admin/impersonate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Impersonation failed.");
  }
  return (await res.json()) as { actionLink: string; fullName: string };
}

export async function updateDoctorRegistration(
  _adminPassword: string,
  doctor: AdminDoctorRegistrationUpdate,
): Promise<AdminDoctorRegistration> {
  const res = await fetch("/api/admin/doctors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doctor),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to update doctor registration.");
  }
  const data = await res.json();
  return normalizeAdminDoctorRegistration((Array.isArray(data.doctor) ? data.doctor[0] : data.doctor) as AdminDoctorRegistration);
}

export async function getNewsletterSendHistory(_adminPassword?: string): Promise<NewsletterSendHistory[]> {
  const res = await fetch("/api/admin/newsletter/history");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to load newsletter history.");
  }
  const data = await res.json();
  return (data.history ?? []) as NewsletterSendHistory[];
}

export async function sendNewsletter(
  _adminPassword: string,
  doctorIds: string[],
  subject: string,
  html: string,
): Promise<NewsletterResponse> {
  const res = await fetch("/api/admin/newsletter/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doctorIds, subject, html }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to send newsletter.");
  }
  return (await res.json()) as NewsletterResponse;
}

export async function getSmsBlastHistory(_adminPassword?: string): Promise<SmsSendHistory[]> {
  const res = await fetch("/api/admin/sms/history");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to load SMS history.");
  }
  const data = await res.json();
  return (data.history ?? []) as SmsSendHistory[];
}

export async function sendSmsBlast(
  _adminPassword: string,
  doctorIds: string[],
  title: string,
  message: string,
): Promise<SmsBlastResponse> {
  const res = await fetch("/api/admin/sms/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doctorIds, title, message }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to send SMS blast.");
  }
  return (await res.json()) as SmsBlastResponse;
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
 * The request goes through /api/auth/send-otp — a server-side proxy that is
 * intercepted by middleware.ts before it reaches Supabase. This ensures the
 * Upstash sliding-window rate limits (per IP and per email) are enforced even
 * when the client reloads or opens multiple tabs.
 *
 * shouldCreateUser stays true in the proxy (see app/api/auth/send-otp/route.ts)
 * for the same reason as before: partner rows predate the auth system.
 */
function partnerAuthRedirectTo() {
  if (typeof window !== "undefined") return `${window.location.origin}/partner`;
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://partners.gutguard.ph").replace(/\/$/, "");
  return `${site}/partner`;
}

export async function sendPartnerOtp(email: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured.");

  const response = await fetch("/api/auth/send-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    // Preserve the HTTP status on the thrown Error so PartnerPortal's
    // getSendError / getResendError handlers can detect rate-limit messages
    // via their existing "rate" / "too many" / "429" text matching.
    throw Object.assign(
      new Error(body?.error ?? "We couldn't send a sign-in code. Please try again."),
      { status: response.status },
    );
  }
}

/** Partner sign-in, step 2: exchange the code for a session. */
export async function verifyPartnerOtp(email: string, token: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase || !supabaseShop) throw new Error("Supabase is not configured.");

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedToken = token.trim();

  // "email" is GoTrue's unified type for a numeric email OTP - it covers both a
  // returning partner's magic-link code and a first-ever login's signup-confirmation
  // code, so one call verifies both cases. A failed verification does not consume the token.
  const { data, error } = await supabase.auth.verifyOtp({
    email: normalizedEmail,
    token: normalizedToken,
    type: "email",
  });

  if (error) throw error;

  // supabaseShop is a second createClient (see lib/supabase.ts) and was built before this
  // session existed, so it is still anonymous in this tab until it is handed the session.
  // Without this the first dashboard read fails and only starts working after a reload.
  if (data.session) await supabaseShop.auth.setSession(data.session);
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

export async function getPartnerAuthEmail(): Promise<string> {
  if (!isSupabaseConfigured || !supabase) return "";
  const { data } = await supabase.auth.getUser();
  return (data.user?.email ?? "").trim().toLowerCase();
}

const DEFAULT_PARTNER_ORDER_PAGE_SIZE = 10;

export async function getPartnerDashboard(query: PartnerDashboardQuery = {}): Promise<PartnerDashboard> {
  if (!isSupabaseConfigured || !supabaseShop) throw new Error("Supabase is not configured.");

  const { data, error } = await supabaseShop.rpc("partner_dashboard", {
    p_scope: query.scope ?? "all",
    p_status: query.status || null,
    p_limit: query.limit ?? DEFAULT_PARTNER_ORDER_PAGE_SIZE,
    p_offset: query.offset ?? 0,
    p_date_from: query.dateFrom || null,
    p_date_to: query.dateTo || null,
    p_sort: query.sort ?? "newest",
  });
  if (error) throw error;

  const row = (data ?? {}) as Record<string, unknown>;
  const partner = (row.partner ?? {}) as Record<string, unknown>;
  const clicks = (row.clicks ?? {}) as Record<string, unknown>;
  const totals = (row.totals ?? {}) as Record<string, unknown>;
  const points = (row.points ?? { current_cycle: 1, points_in_cycle: 0, total_all_time: 0, own_points: 0, passup_points: 0 }) as Record<string, unknown>;
  const ordersPage = (row.orders_page ?? {}) as Record<string, unknown>;

  return {
    partner: {
      id: String(partner.id ?? ""),
      full_name: String(partner.full_name ?? ""),
      routing_slug: String(partner.routing_slug ?? ""),
      store_type: (partner.store_type ?? "affiliate") as StoreType,
      referral_qr_enabled: Boolean(partner.referral_qr_enabled ?? false),
      main_store_id: partner.main_store_id ? String(partner.main_store_id) : null,
      promoted_at: partner.promoted_at ? String(partner.promoted_at) : null,
      promoted_by: partner.promoted_by ? String(partner.promoted_by) : null,
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
      direct_orders: Number(totals.direct_orders ?? totals.orders ?? 0),
      referred_orders: Number(totals.referred_orders ?? 0),
      referred_partners: Number(totals.referred_partners ?? 0),
      direct_paid_amount: Number(totals.direct_paid_amount ?? 0),
      referred_paid_amount: Number(totals.referred_paid_amount ?? 0),
    },
    points: {
      direct_points: Number(points.own_points ?? points.direct_points ?? 0),
      referred_points: Number(points.passup_points ?? points.referred_points ?? 0),
      current_cycle: Number(points.current_cycle ?? 1),
      points_in_cycle: Number(points.points_in_cycle ?? 0),
      lifetime_points: Number(points.total_all_time ?? points.lifetime_points ?? 0),
      own_points: Number(points.own_points ?? 0),
      passup_points: Number(points.passup_points ?? 0),
      passed_up_to_upline_points: Number(points.passed_up_to_upline_points ?? 0),
    },
    rebates: (Array.isArray(row.rebates) ? row.rebates : []).map((entry) => {
      const rebateRow = (entry ?? {}) as Record<string, unknown>;
      return {
        cycle_number: Number(rebateRow.cycle_number ?? 1),
        milestone_pts: Number(rebateRow.milestone_pts ?? 0),
        rebate_amount: Number(rebateRow.rebate_amount ?? 0),
        status: String(rebateRow.status ?? "unlocked"),
        created_at: String(rebateRow.created_at ?? ""),
      };
    }),
    point_sources: (Array.isArray(row.point_sources) ? row.point_sources : []).map((entry) => {
      const psRow = (entry ?? {}) as Record<string, unknown>;
      return {
        order_code: String(psRow.order_code ?? ""),
        points: Number(psRow.points ?? 0),
        depth: Number(psRow.depth ?? 0),
        source_partner: String(psRow.source_partner ?? ""),
        created_at: String(psRow.created_at ?? ""),
      };
    }),
    orders: (Array.isArray(row.orders) ? row.orders : []).map(normalizePartnerOrder),
    orders_page: {
      total: Number(ordersPage.total ?? 0),
      limit: Number(ordersPage.limit ?? DEFAULT_PARTNER_ORDER_PAGE_SIZE),
      offset: Number(ordersPage.offset ?? 0),
      has_more: Boolean(ordersPage.has_more),
    },
    referred_partners: (Array.isArray(row.referred_partners) ? row.referred_partners : []).map((entry) => {
      const partnerRow = (entry ?? {}) as Record<string, unknown>;
      return {
        full_name: String(partnerRow.full_name ?? ""),
        routing_slug: String(partnerRow.routing_slug ?? ""),
        specialty: String(partnerRow.specialty ?? ""),
        practice_location: String(partnerRow.practice_location ?? ""),
        store_type: (partnerRow.store_type ?? "affiliate") as StoreType,
        referral_qr_enabled: Boolean(partnerRow.referral_qr_enabled ?? false),
        joined_at: String(partnerRow.joined_at ?? ""),
        orders: Number(partnerRow.orders ?? 0),
        paid_order_value: Number(partnerRow.paid_order_value ?? 0),
      };
    }),
  };
}

export async function getMainStoreDashboard(): Promise<MainStoreDashboard> {
  if (!isSupabaseConfigured || !supabaseShop) throw new Error("Supabase is not configured.");

  const { data, error } = await supabaseShop.rpc("get_main_store_dashboard");
  if (error) throw error;

  const row = (data ?? {}) as Record<string, unknown>;
  const mainStore = (row.main_store ?? {}) as Record<string, unknown>;

  return {
    main_store: {
      id: String(mainStore.id ?? ""),
      full_name: String(mainStore.full_name ?? ""),
      routing_slug: String(mainStore.routing_slug ?? ""),
      email: String(mainStore.email ?? ""),
      store_type: (mainStore.store_type ?? "main") as StoreType,
      referral_qr_enabled: Boolean(mainStore.referral_qr_enabled ?? true),
    },
    lifestyle_count: Number(row.lifestyle_count ?? 0),
    affiliate_count: Number(row.affiliate_count ?? 0),
    total_orders: Number(row.total_orders ?? 0),
    total_revenue: Number(row.total_revenue ?? 0),
    combined_points: Number(row.combined_points ?? 0),
    own_points: Number(row.own_points ?? 0),
    passup_points: Number(row.passup_points ?? 0),
  };
}

export async function getMainStoreReports(query: {
  scope?: string;
  storeId?: string;
  status?: string;
  limit?: number;
  offset?: number;
  dateFrom?: string;
  dateTo?: string;
  sort?: "newest" | "oldest";
} = {}): Promise<MainStoreReports> {
  if (!isSupabaseConfigured || !supabaseShop) throw new Error("Supabase is not configured.");

  const { data, error } = await supabaseShop.rpc("get_main_store_reports", {
    p_scope: query.scope ?? "all",
    p_store_id: query.storeId || null,
    p_status: query.status || null,
    p_limit: query.limit ?? DEFAULT_PARTNER_ORDER_PAGE_SIZE,
    p_offset: query.offset ?? 0,
    p_date_from: query.dateFrom || null,
    p_date_to: query.dateTo || null,
    p_sort: query.sort ?? "newest",
  });
  if (error) throw error;

  const row = (data ?? {}) as Record<string, unknown>;
  const orders = Array.isArray(row.orders) ? row.orders : [];
  const stores = Array.isArray(row.stores) ? row.stores : [];

  return {
    total_orders: Number(row.total_orders ?? 0),
    orders: orders.map((o) => {
      const order = (o ?? {}) as Record<string, unknown>;
      return {
        order_code: String(order.order_code ?? ""),
        created_at: String(order.created_at ?? ""),
        status: (order.status ?? "pending_payment") as ShopOrderStatus,
        payment_status: (order.payment_status ?? "pending") as ShopPaymentStatus,
        total_amount: Number(order.total_amount ?? 0),
        buyer_name: String(order.buyer_name ?? ""),
        store_id: String(order.store_id ?? ""),
        store_name: String(order.store_name ?? ""),
        store_type: (order.store_type ?? "lifestyle") as StoreType,
        store_slug: String(order.store_slug ?? ""),
      };
    }),
    stores: stores.map((s) => {
      const store = (s ?? {}) as Record<string, unknown>;
      return {
        id: String(store.id ?? ""),
        full_name: String(store.full_name ?? ""),
        store_type: (store.store_type ?? "lifestyle") as StoreType,
        routing_slug: String(store.routing_slug ?? ""),
        specialty: String(store.specialty ?? ""),
        practice_location: String(store.practice_location ?? ""),
        created_at: String(store.created_at ?? ""),
        referral_qr_enabled: Boolean(store.referral_qr_enabled ?? false),
        orders_count: Number(store.orders_count ?? 0),
        revenue: Number(store.revenue ?? 0),
        points: Number(store.points ?? 0),
      };
    }),
  };
}

export async function adminUpgradeToMainStore(partnerId: string, note?: string): Promise<{ success: boolean; descendants_moved: number }> {
  const res = await fetch("/api/admin/doctors/upgrade-main", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ partnerId, note }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to upgrade partner to Main Store.");
  }
  return res.json();
}

export async function adminToggleReferralQr(partnerId: string, enabled: boolean): Promise<{ success: boolean; referral_qr_enabled: boolean }> {
  const res = await fetch("/api/admin/doctors/toggle-qr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ partnerId, enabled }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to toggle Referral QR.");
  }
  return res.json();
}

export async function adminPromotePartner(partnerId: string, note?: string): Promise<{ success: boolean; store_type: StoreType }> {
  const res = await fetch("/api/admin/doctors/promote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ partnerId, note }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to promote partner to Lifestyle.");
  }
  return res.json();
}

function normalizePartnerOrder(entry: unknown): PartnerOrder {
  const order = (entry ?? {}) as Record<string, unknown>;
  return {
    order_code: String(order.order_code ?? ""),
    created_at: String(order.created_at ?? ""),
    status: (order.status ?? "pending_payment") as ShopOrderStatus,
    payment_status: (order.payment_status ?? "pending") as ShopPaymentStatus,
    total_amount: Number(order.total_amount ?? 0),
    buyer_first_name: String(order.buyer_first_name ?? ""),
    // Older rows predate these keys, so fall back rather than render "undefined".
    buyer_name: String(order.buyer_name ?? order.buyer_first_name ?? ""),
    buyer_email: String(order.buyer_email ?? ""),
    buyer_mobile: String(order.buyer_mobile ?? ""),
    address: String(order.address ?? ""),
    barangay: String(order.barangay ?? ""),
    zip: String(order.zip ?? ""),
    city: String(order.city ?? ""),
    province: String(order.province ?? ""),
    source_type: order.source_type === "referred" ? "referred" : "direct",
    source_partner_name: String(order.source_partner_name ?? ""),
    source_partner_slug: String(order.source_partner_slug ?? ""),
  };
}

export async function adminListShopOrders(_adminPassword?: string): Promise<ShopOrder[]> {
  const res = await fetch("/api/admin/shop-orders");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to load shop orders.");
  }
  const data = await res.json();
  return ((data.orders ?? []) as unknown[]).map(normalizeShopOrder);
}

export async function adminGetShopOrder(_adminPassword?: string, orderId?: string): Promise<ShopOrder> {
  const res = await fetch(`/api/admin/shop-orders?orderId=${encodeURIComponent(orderId ?? "")}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to get shop order.");
  }
  const data = await res.json();
  return normalizeShopOrder(Array.isArray(data.order) ? data.order[0] : data.order);
}

export async function adminUpdateShopOrder(
  _adminPassword: string,
  update: ShopOrderAdminUpdate,
): Promise<ShopOrder> {
  const res = await fetch("/api/admin/shop-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to update shop order.");
  }
  const data = await res.json();
  return normalizeShopOrder(Array.isArray(data.order) ? data.order[0] : data.order);
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
  _adminPassword: string,
  action: TikTokAdminAction,
  payload?: Record<string, unknown>,
): Promise<TResponse> {
  const res = await fetch("/api/admin/tiktok", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "TikTok admin request failed.");
  }
  return (await res.json()) as TResponse;
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

export async function getSequenceSteps(_adminPassword?: string): Promise<SequenceStep[]> {
  const res = await fetch("/api/admin/sequence?type=steps");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to load sequence steps.");
  }
  const data = await res.json();
  return (data.steps ?? []) as SequenceStep[];
}

export async function upsertSequenceStep(
  _adminPassword: string,
  step: { id?: string; stepNumber: number; subject: string; htmlBody: string; attachments?: SequenceAttachment[] },
): Promise<SequenceStep> {
  const res = await fetch("/api/admin/sequence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "upsert", step }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to upsert sequence step.");
  }
  const data = await res.json();
  return data.step as SequenceStep;
}

export async function deleteSequenceStep(_adminPassword: string, stepId: string): Promise<void> {
  const res = await fetch("/api/admin/sequence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", stepId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to delete sequence step.");
  }
}

export async function reorderSequenceSteps(_adminPassword: string, stepIds: string[]): Promise<void> {
  const res = await fetch("/api/admin/sequence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reorder", stepIds }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to reorder sequence steps.");
  }
}

export async function getSequenceProgress(
  _adminPassword?: string,
): Promise<{ progress: SequenceProgress[]; totalSteps: number }> {
  const res = await fetch("/api/admin/sequence?type=progress");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to load sequence progress.");
  }
  return (await res.json()) as { progress: SequenceProgress[]; totalSteps: number };
}

type SequenceStepSendResponse = {
  sent?: boolean;
  skipped?: boolean;
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
  if (data?.skipped) return data;
  if (!data?.sent) throw new Error(data?.reason || "Drip Campaign Step 1 was not sent.");
  return data;
}

/** Sends the welcome email once, after a new partner has verified their sign-in code. */
export async function enrollWelcomeIfNeeded(doctorId: string): Promise<void> {
  if (!doctorId || doctorId.startsWith("local-") || !isSupabaseConfigured || !supabase) return;
  const { data, error } = await supabase.functions.invoke<SequenceStepSendResponse>("send-sequence-step", {
    body: { doctorId, stepNumber: 1, onlyIfUnenrolled: true },
  });
  if (error) throw error;
  if (data?.skipped) return;
  if (!data?.sent) throw new Error(data?.reason || "Welcome email was not sent.");
}

export async function resendSequenceStep(doctorId: string, stepNumber: number): Promise<SequenceStepSendResponse> {
  const res = await fetch("/api/admin/sequence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "resend", doctorId, stepNumber }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to resend step.");
  return { sent: true };
}

// ─── Registration Email Settings ───────────────────────────────────────────

export async function getRegistrationEmailSettings(_adminPassword?: string): Promise<RegistrationEmailSettings> {
  const res = await fetch("/api/admin/registration-email");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to load registration email settings.");
  }
  const data = await res.json();
  return data.settings as RegistrationEmailSettings;
}

export async function saveRegistrationEmailSettings(
  _adminPassword: string,
  settings: RegistrationEmailSettings,
): Promise<RegistrationEmailSettings> {
  const res = await fetch("/api/admin/registration-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "save", settings }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to save registration email settings.");
  }
  const data = await res.json();
  return data.settings as RegistrationEmailSettings;
}

export async function sendRegistrationEmailTest(
  _adminPassword: string,
  testEmail: string,
): Promise<RegistrationEmailTestResponse> {
  const res = await fetch("/api/admin/registration-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "test", testEmail }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to send registration email test.");
  }
  return (await res.json()) as RegistrationEmailTestResponse;
}

async function referralEmailRequest(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/registration-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, templateKind: "partner-referral" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Referral email request failed.");
  return data;
}

export async function getPartnerReferralEmailSettings(_adminPassword?: string): Promise<RegistrationEmailSettings> {
  return (await referralEmailRequest({ action: "get" })).settings as RegistrationEmailSettings;
}

export async function savePartnerReferralEmailSettings(_adminPassword: string, settings: RegistrationEmailSettings): Promise<RegistrationEmailSettings> {
  return (await referralEmailRequest({ action: "save", settings })).settings as RegistrationEmailSettings;
}

export async function sendPartnerReferralEmailTest(_adminPassword: string, testEmail: string): Promise<RegistrationEmailTestResponse> {
  return (await referralEmailRequest({ action: "test", testEmail })) as RegistrationEmailTestResponse;
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
    name_prefix: doctor.name_prefix ?? "",
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

/* --- Testimonials ---------------------------------------------------------- */

/**
 * Photos go straight from the browser to Storage with the anon key; the bucket caps
 * type and size, and `checkImageFile` rejects the obvious cases before the round trip.
 * Paths are uuid-prefixed so two members uploading `photo.jpg` cannot collide, and so
 * an uploader cannot guess or target someone else's object.
 */
export async function uploadTestimonialPhoto(file: File, folder: string): Promise<string> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const rejection = checkImageFile(file);
  if (rejection) throw new Error(rejection);

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from(TESTIMONIAL_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) throw error;
  return path;
}

export async function submitTestimonial(input: {
  displayName: string;
  email: string;
  roleLine: string;
  story: string;
  avatarPath: string | null;
  photoPaths: string[];
  videoFileId: string | null;
}): Promise<string> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.rpc("submit_testimonial", {
    p_display_name: input.displayName.trim(),
    p_email: input.email.trim().toLowerCase(),
    p_role_line: input.roleLine.trim(),
    p_story: input.story.trim(),
    p_avatar_path: input.avatarPath,
    p_photo_paths: input.photoPaths,
    p_video_file_id: input.videoFileId,
    p_consent: true,
  });

  if (error) throw error;
  return data as string;
}

/**
 * Approved rows only, and never the submitter's email - that filtering lives in the
 * security-definer function, not here, because this runs with the public anon key.
 * Returns an empty wall rather than throwing when Supabase is unconfigured, so a
 * preview build without env vars still renders the page.
 */
export async function listTestimonials(limit = 60): Promise<PublicTestimonial[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase.rpc("list_testimonials", { p_limit: limit });

  // The wall is a public marketing page, so it renders empty rather than 500ing in the
  // window between this deploying and the testimonials migration being applied.
  if (error && isMissingSupabaseFunctionError(error)) return [];
  if (error) throw error;
  return (data ?? []) as PublicTestimonial[];
}

export async function adminListTestimonials(
  _adminPassword?: string,
  status?: TestimonialStatus,
): Promise<AdminTestimonial[]> {
  const url = status
    ? `/api/admin/testimonials?status=${encodeURIComponent(status)}`
    : "/api/admin/testimonials";
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to load testimonials.");
  }
  const data = await res.json();
  return (data.stories ?? []) as AdminTestimonial[];
}

export async function adminReviewTestimonial(
  _adminPassword: string,
  input: { id: string; status: TestimonialStatus; featured?: boolean; reviewNote?: string },
): Promise<AdminTestimonial> {
  const res = await fetch("/api/admin/testimonials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to review testimonial.");
  }
  const data = await res.json();
  return data.story as AdminTestimonial;
}
