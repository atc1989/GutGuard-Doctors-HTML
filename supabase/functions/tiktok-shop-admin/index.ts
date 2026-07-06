import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type TikTokOrderTimeMode = "create_time" | "update_time";

type TikTokOrdersFilters = {
  timeMode?: TikTokOrderTimeMode;
  startTime?: number;
  endTime?: number;
  orderStatus?: string;
  pageSize?: number;
  pageToken?: string;
};

type TikTokAdminRequest = {
  adminPassword?: string;
  filters?: TikTokOrdersFilters;
};

type TikTokOrderRecord = Record<string, unknown>;

type TikTokConfig = {
  baseUrl: string;
  authBaseUrl: string;
  apiVersion: string;
  appKey: string;
  appSecret: string;
  shopCipher: string;
};

type TikTokCredentialsRow = {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
  refresh_token_expires_at?: number | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { adminPassword, filters } = (await req.json()) as TikTokAdminRequest;
    if (!adminPassword) return jsonResponse({ error: "Missing adminPassword" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Missing Supabase Edge Function secrets" }, 500);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { error: adminError } = await supabase.rpc("assert_wheel_admin", {
      p_admin_password: adminPassword,
    });
    if (adminError) return jsonResponse({ error: "Invalid admin password" }, 401);

    const config = getTikTokConfig();
    const tokenResult = await getValidAccessToken(supabase, config);
    const cleanFilters = normalizeFilters(filters);
    const path = `/order/${config.apiVersion}/orders/search`;
    const body = buildRequestBody(cleanFilters);
    const bodyJson = JSON.stringify(body);
    const query: Record<string, string> = {
      app_key: config.appKey,
      page_size: String(cleanFilters.pageSize),
      shop_cipher: config.shopCipher,
      timestamp: Math.floor(Date.now() / 1000).toString(),
    };
    if (cleanFilters.pageToken) query.page_token = cleanFilters.pageToken;

    const sign = await generateTikTokSign({
      appSecret: config.appSecret,
      path,
      query,
      bodyJson,
    });
    const url = new URL(path, config.baseUrl);

    for (const [key, value] of Object.entries({ ...query, sign, access_token: tokenResult.accessToken })) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tts-access-token": tokenResult.accessToken,
      },
      body: bodyJson,
    });
    const raw = await readResponseBody(response);

    if (!response.ok) {
      return jsonResponse(
        {
          error: getTikTokErrorMessage(raw) || `TikTok Shop request failed with HTTP ${response.status}`,
          raw,
          debug: buildDebug(config.baseUrl, path, query, body, tokenResult.refreshed),
        },
        response.status === 401 || response.status === 403 ? 401 : 502,
      );
    }

    const parsed = parseTikTokOrderResponse(raw);
    return jsonResponse({
      ...parsed,
      debug: buildDebug(config.baseUrl, path, query, body, tokenResult.refreshed),
      raw,
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});

function getTikTokConfig(): TikTokConfig {
  const baseUrl = trimTrailingSlash(Deno.env.get("TIKTOK_SHOP_BASE_URL") ?? "https://open-api.tiktokglobalshop.com");
  const authBaseUrl = trimTrailingSlash(Deno.env.get("TIKTOK_SHOP_AUTH_BASE_URL") ?? "https://auth.tiktok-shops.com");
  const apiVersion = (Deno.env.get("TIKTOK_SHOP_API_VERSION") ?? "202309").trim();
  const appKey = (Deno.env.get("TIKTOK_SHOP_APP_KEY") ?? "").trim();
  const appSecret = (Deno.env.get("TIKTOK_SHOP_APP_SECRET") ?? "").trim();
  const shopCipher = (Deno.env.get("TIKTOK_SHOP_SHOP_CIPHER") ?? "").trim();

  const missing = [
    ["TIKTOK_SHOP_APP_KEY", appKey],
    ["TIKTOK_SHOP_APP_SECRET", appSecret],
    ["TIKTOK_SHOP_SHOP_CIPHER", shopCipher],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) throw new Error(`Missing TikTok Shop secrets: ${missing.join(", ")}`);

  return { baseUrl, authBaseUrl, apiVersion, appKey, appSecret, shopCipher };
}

async function getValidAccessToken(
  supabase: ReturnType<typeof createClient>,
  config: TikTokConfig,
) {
  const { data, error } = await supabase
    .from("tiktok_credentials")
    .select("id, access_token, refresh_token, expires_at, refresh_token_expires_at")
    .eq("id", "default")
    .single();

  if (error) {
    throw new Error(`TikTok credentials lookup failed: ${error.message}`);
  }

  if (!data) {
    throw new Error("TikTok credentials are not configured. Run supabase/tiktok-shop-credentials.sql and seed the refresh token.");
  }

  const credentials = data as TikTokCredentialsRow;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = Number(credentials.expires_at ?? 0);

  if (credentials.access_token && expiresAt - now >= 300) {
    return { accessToken: credentials.access_token, refreshed: false };
  }

  if (!credentials.refresh_token) {
    throw new Error("TikTok refresh token is missing. Re-authorize the TikTok Shop merchant.");
  }

  const refreshed = await refreshTikTokToken(config, credentials.refresh_token);
  const nextExpiresAt = normalizeTokenExpiry(refreshed.accessTokenExpireIn, now);
  const nextRefreshExpiresAt = refreshed.refreshTokenExpireIn
    ? normalizeTokenExpiry(refreshed.refreshTokenExpireIn, now)
    : credentials.refresh_token_expires_at ?? null;

  const { error: updateError } = await supabase
    .from("tiktok_credentials")
    .update({
      access_token: refreshed.accessToken,
      refresh_token: refreshed.refreshToken,
      expires_at: nextExpiresAt,
      refresh_token_expires_at: nextRefreshExpiresAt,
    })
    .eq("id", credentials.id);

  if (updateError) throw new Error(`TikTok token refresh could not be saved: ${updateError.message}`);

  return { accessToken: refreshed.accessToken, refreshed: true };
}

async function refreshTikTokToken(config: TikTokConfig, refreshToken: string) {
  const url = new URL("/api/v2/token/refresh", config.authBaseUrl);
  url.searchParams.set("app_key", config.appKey);
  url.searchParams.set("app_secret", config.appSecret);
  url.searchParams.set("refresh_token", refreshToken);
  url.searchParams.set("grant_type", "refresh_token");

  const response = await fetch(url, { method: "GET" });
  const raw = await readResponseBody(response);

  if (!response.ok || !isRecord(raw) || getNumber(raw.code) !== 0 || !isRecord(raw.data)) {
    throw new Error(getTikTokErrorMessage(raw) || "TikTok Shop re-authorization is required.");
  }

  const data = raw.data;
  const accessToken = getString(data.access_token);
  const nextRefreshToken = getString(data.refresh_token);
  const accessTokenExpireIn = getNumber(data.access_token_expire_in);
  const refreshTokenExpireIn = getNumber(data.refresh_token_expire_in);

  if (!accessToken || !nextRefreshToken || !accessTokenExpireIn) {
    throw new Error("TikTok token refresh response was missing required token fields.");
  }

  return {
    accessToken,
    refreshToken: nextRefreshToken,
    accessTokenExpireIn,
    refreshTokenExpireIn,
  };
}

function normalizeTokenExpiry(value: number, now: number) {
  const oneYearInSeconds = 365 * 24 * 60 * 60;
  return value > now + oneYearInSeconds ? value : now + value;
}

function normalizeFilters(filters: TikTokOrdersFilters | undefined): Required<TikTokOrdersFilters> {
  const now = Math.floor(Date.now() / 1000);
  const sevenDaysAgo = now - 7 * 24 * 60 * 60;
  const timeMode = filters?.timeMode === "update_time" ? "update_time" : "create_time";
  const pageSize = clampNumber(filters?.pageSize, 1, 100, 20);
  const startTime = normalizeUnixTime(filters?.startTime) ?? sevenDaysAgo;
  const endTime = normalizeUnixTime(filters?.endTime) ?? now;

  if (startTime > endTime) throw new Error("Start time must be before end time.");

  return {
    timeMode,
    startTime,
    endTime,
    orderStatus: sanitizeToken(filters?.orderStatus),
    pageSize,
    pageToken: sanitizeToken(filters?.pageToken),
  };
}

function buildRequestBody(filters: Required<TikTokOrdersFilters>) {
  const body: Record<string, unknown> = {};

  if (filters.timeMode === "update_time") {
    body.update_time_ge = filters.startTime;
    body.update_time_lt = filters.endTime;
  } else {
    body.create_time_ge = filters.startTime;
    body.create_time_lt = filters.endTime;
  }

  if (filters.orderStatus) body.order_status = filters.orderStatus;
  return body;
}

async function generateTikTokSign(input: {
  appSecret: string;
  path: string;
  query: Record<string, string>;
  bodyJson: string;
}) {
  const sortedParamString = Object.keys(input.query)
    .filter((key) => key !== "sign" && key !== "access_token")
    .sort()
    .map((key) => `${key}${input.query[key]}`)
    .join("");
  const signatureBase = `${input.appSecret}${input.path}${sortedParamString}${input.bodyJson}${input.appSecret}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(input.appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signatureBase));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function parseTikTokOrderResponse(raw: unknown) {
  if (!raw || typeof raw !== "object") throw new Error("TikTok response was not valid JSON.");

  const root = raw as Record<string, unknown>;
  const data = isRecord(root.data) ? root.data : root;
  const ordersValue = Array.isArray(data.orders) ? data.orders : [];
  const orders = ordersValue.map((order) => normalizeOrder(order as TikTokOrderRecord));
  const totalCount = getNumber(data.total_count) ?? getNumber(data.total);
  const nextPageToken = getString(data.next_page_token) ?? getString(data.nextPageToken) ?? "";

  return {
    orders,
    nextPageToken,
    totalCount,
  };
}

function normalizeOrder(order: TikTokOrderRecord) {
  const payment = getRecord(order.payment) ?? getRecord(order.payment_info) ?? {};
  const recipientAddress = getRecord(order.recipient_address) ?? {};
  const packages = Array.isArray(order.packages) ? order.packages : [];
  const firstPackage = getRecord(packages[0]) ?? {};
  const totalAmount = getRecord(payment.total_amount) ?? getRecord(payment.order_total) ?? {};

  return {
    id: getString(order.id) ?? getString(order.order_id) ?? "",
    status: getString(order.status) ?? getString(order.order_status) ?? "",
    createTime: formatUnixTime(order.create_time),
    updateTime: formatUnixTime(order.update_time),
    buyerEmail: getString(order.buyer_email) ?? "",
    deliveryOptionName: getString(order.delivery_option_name) ?? getString(firstPackage.delivery_option_name) ?? "",
    shippingProvider:
      getString(order.shipping_provider) ??
      getString(firstPackage.shipping_provider_name) ??
      getString(recipientAddress.region_code) ??
      "",
    trackingNumber: getString(order.tracking_number) ?? getString(firstPackage.tracking_number) ?? "",
    paymentAmount:
      getString(totalAmount.amount) ??
      getString(payment.total_amount) ??
      getString(payment.order_total) ??
      "",
    currency:
      getString(totalAmount.currency) ??
      getString(payment.currency) ??
      getString(payment.currency_code) ??
      "",
  };
}

async function readResponseBody(response: Response) {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function buildDebug(
  baseUrl: string,
  path: string,
  query: Record<string, string>,
  body: Record<string, unknown>,
  tokenRefreshed: boolean,
) {
  return {
    method: "POST",
    path,
    query: {
      ...query,
      app_key: maskValue(query.app_key),
      shop_cipher: maskValue(query.shop_cipher),
    },
    body,
    baseUrl,
    tokenRefreshed,
    requestedAt: new Date().toISOString(),
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getTikTokErrorMessage(raw: unknown) {
  if (typeof raw === "string") return raw;
  if (!isRecord(raw)) return "";
  const message = raw.message ?? raw.error_msg ?? raw.error;
  return typeof message === "string" ? message : "";
}

function formatUnixTime(value: unknown) {
  const seconds = getNumber(value);
  if (!seconds) return "";
  return new Date(seconds * 1000).toISOString();
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
}

function getNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeUnixTime(value: unknown) {
  const number = getNumber(value);
  if (!number || number < 0) return undefined;
  return Math.floor(number);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = getNumber(value);
  if (!number) return fallback;
  return Math.min(max, Math.max(min, Math.floor(number)));
}

function sanitizeToken(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 300);
}

function maskValue(value: string) {
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}
