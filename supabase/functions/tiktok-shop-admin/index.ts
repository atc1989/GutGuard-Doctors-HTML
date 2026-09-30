import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type TikTokOrderTimeMode = "create_time" | "update_time";

type TikTokAdminAction =
  | "get-order-list"
  | "get-order-detail"
  | "get-price-detail"
  | "add-external-order-reference"
  | "get-external-order-references"
  | "search-order-by-external-reference"
  | "update-blind-box-opening-results"
  | "raw-api-request";

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
  action?: TikTokAdminAction;
  payload?: Record<string, unknown>;
  filters?: TikTokOrdersFilters;
};

type TikTokApiRequest = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
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
    const request = (await req.json()) as TikTokAdminRequest;
    if (!request.adminPassword) return jsonResponse({ error: "Missing adminPassword" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Missing Supabase Edge Function secrets" }, 500);

    const supabase = createClient(supabaseUrl, serviceRoleKey, { db: { schema: "doctors" } });
    const { error: adminError } = await supabase.rpc("assert_wheel_admin", {
      p_admin_password: request.adminPassword,
    });
    if (adminError) return jsonResponse({ error: "Invalid admin password" }, 401);

    const action = request.action ?? (request.filters ? "get-order-list" : undefined);
    if (!action) return jsonResponse({ error: "Missing TikTok admin action" }, 400);

    const config = getTikTokConfig();
    const tokenResult = await getValidAccessToken(supabase, config);
    const payload = request.payload ?? {};
    const apiRequest = buildTikTokApiRequest(action, payload, request.filters, config);
    const { raw, debug, status } = await callTikTokApi(config, tokenResult, apiRequest);

    if (status < 200 || status >= 300 || isTikTokApiError(raw)) {
      return jsonResponse(
        {
          error: getTikTokErrorMessage(raw) || `TikTok Shop request failed with HTTP ${status}`,
          raw,
          debug,
        },
        status === 401 || status === 403 ? 401 : 502,
      );
    }

    if (action === "get-order-list") {
      return jsonResponse({
        ...parseTikTokOrderResponse(raw),
        debug,
        raw,
      });
    }

    return jsonResponse({
      ...normalizeActionResponse(action, payload, raw),
      debug,
      raw,
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});

function buildTikTokApiRequest(
  action: TikTokAdminAction,
  payload: Record<string, unknown>,
  legacyFilters: TikTokOrdersFilters | undefined,
  config: TikTokConfig,
): TikTokApiRequest {
  if (action === "get-order-list") {
    const filterSource = Object.keys(payload).length > 0 ? (payload as TikTokOrdersFilters) : legacyFilters;
    const cleanFilters = normalizeFilters(filterSource);
    return {
      method: "POST",
      path: `/order/${config.apiVersion}/orders/search`,
      query: {
        page_size: String(cleanFilters.pageSize),
        ...(cleanFilters.pageToken ? { page_token: cleanFilters.pageToken } : {}),
      },
      body: buildOrderListBody(cleanFilters),
    };
  }

  if (action === "get-order-detail") {
    const orderId = requireCleanString(payload.orderId, "orderId");
    return {
      method: "GET",
      path: `/order/${config.apiVersion}/orders`,
      query: {
        ids: JSON.stringify([orderId]),
      },
    };
  }

  if (action === "get-price-detail") {
    const orderId = requireCleanString(payload.orderId, "orderId");
    const version = (Deno.env.get("TIKTOK_SHOP_PRICE_API_VERSION") ?? "202407").trim();
    return {
      method: "GET",
      path: `/order/${version}/orders/${encodeURIComponent(orderId)}/price_detail`,
    };
  }

  if (action === "add-external-order-reference") {
    const version = (Deno.env.get("TIKTOK_SHOP_REFERENCE_API_VERSION") ?? "202406").trim();
    const orderId = requireCleanString(payload.orderId, "orderId");
    const externalOrderReference = requireCleanString(payload.externalOrderReference, "externalOrderReference");
    return {
      method: "POST",
      path: `/order/${version}/orders/${encodeURIComponent(orderId)}/external_order_references`,
      body: { external_order_reference: externalOrderReference },
    };
  }

  if (action === "get-external-order-references") {
    const version = (Deno.env.get("TIKTOK_SHOP_REFERENCE_API_VERSION") ?? "202406").trim();
    const orderId = requireCleanString(payload.orderId, "orderId");
    return {
      method: "GET",
      path: `/order/${version}/orders/${encodeURIComponent(orderId)}/external_order_references`,
    };
  }

  if (action === "search-order-by-external-reference") {
    const version = (Deno.env.get("TIKTOK_SHOP_REFERENCE_API_VERSION") ?? "202406").trim();
    const externalOrderReference = requireCleanString(payload.externalOrderReference, "externalOrderReference");
    return {
      method: "POST",
      path: `/order/${version}/orders/external_order_references/search`,
      body: { external_order_reference: externalOrderReference },
    };
  }

  if (action === "update-blind-box-opening-results") {
    const rawRequest = getRawApiRequest(payload);
    if (!rawRequest.path.includes("blind_box")) {
      throw new Error("Blind Box updates must use an explicit blind box order endpoint path.");
    }
    return rawRequest;
  }

  return getRawApiRequest(payload);
}

async function callTikTokApi(
  config: TikTokConfig,
  tokenResult: { accessToken: string; refreshed: boolean },
  request: TikTokApiRequest,
) {
  const body = request.body ?? {};
  const bodyJson = request.method === "GET" || request.method === "DELETE" ? "" : JSON.stringify(body);
  const query: Record<string, string> = {
    ...(request.query ?? {}),
    app_key: config.appKey,
    shop_cipher: config.shopCipher,
    timestamp: Math.floor(Date.now() / 1000).toString(),
  };
  const sign = await generateTikTokSign({
    appSecret: config.appSecret,
    path: request.path,
    query,
    bodyJson,
  });
  const url = new URL(request.path, config.baseUrl);

  for (const [key, value] of Object.entries({ ...query, sign, access_token: tokenResult.accessToken })) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      "x-tts-access-token": tokenResult.accessToken,
    },
    ...(bodyJson ? { body: bodyJson } : {}),
  });
  const raw = await readResponseBody(response);

  return {
    raw,
    status: response.status,
    debug: buildDebug(config.baseUrl, request.method, request.path, query, body, tokenResult.refreshed),
  };
}

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

function buildOrderListBody(filters: Required<TikTokOrdersFilters>) {
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

function normalizeActionResponse(action: TikTokAdminAction, payload: Record<string, unknown>, raw: unknown) {
  if (action === "get-order-detail") return { order: normalizeOrderDetail(raw) };
  if (action === "get-price-detail") return { price: normalizePriceDetail(payload, raw) };
  if (
    action === "add-external-order-reference" ||
    action === "get-external-order-references" ||
    action === "search-order-by-external-reference"
  ) {
    return { references: normalizeReferences(raw) };
  }
  return {};
}

function normalizeOrder(order: TikTokOrderRecord) {
  const payment = getRecord(order.payment) ?? getRecord(order.payment_info) ?? {};
  const recipientAddress = getRecord(order.recipient_address) ?? {};
  const packages = Array.isArray(order.packages) ? order.packages : [];
  const firstPackage = getRecord(packages[0]) ?? {};
  const lineItems = Array.isArray(order.line_items) ? order.line_items : [];
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
    buyerMessage: getString(order.buyer_message) ?? "",
    commercePlatform: getString(order.commerce_platform) ?? "",
    fulfillmentType: getString(order.fulfillment_type) ?? "",
    isReplacementOrder: getBoolean(order.is_replacement_order),
    isSampleOrder: getBoolean(order.is_sample_order),
    lineItemCount: lineItems.length,
  };
}

function normalizeOrderDetail(raw: unknown) {
  const data = isRecord(raw) && isRecord(raw.data) ? raw.data : raw;
  const orders = isRecord(data) && Array.isArray(data.orders) ? data.orders : [];
  const order = getRecord(orders[0]) ?? getRecord(data) ?? {};
  const summary = normalizeOrder(order);
  const lineItems = Array.isArray(order.line_items) ? order.line_items.map(normalizeLineItem) : [];
  const packages = Array.isArray(order.packages) ? order.packages.map(normalizePackage) : [];
  const payment = getRecord(order.payment) ?? getRecord(order.payment_info) ?? {};

  return {
    summary,
    lineItems,
    packages,
    payment: normalizePayment(payment),
  };
}

function normalizePriceDetail(payload: Record<string, unknown>, raw: unknown) {
  const data = isRecord(raw) && isRecord(raw.data) ? raw.data : raw;
  const source = getRecord(data) ?? {};
  const detail =
    getRecord(source.price_detail) ??
    getRecord(source.price_details) ??
    getRecord(source.order_price_detail) ??
    getRecord(source.order_price) ??
    source;
  const payment = getRecord(detail.payment) ?? getRecord(source.payment) ?? detail;
  const lineItems = getArray(detail.line_items) ?? getArray(source.line_items) ?? getArray(detail.sku_price_details) ?? [];
  const currency =
    getString(payment.currency) ??
    getString(payment.currency_code) ??
    getString(detail.currency) ??
    getString(source.currency) ??
    getString(getRecord(lineItems[0])?.currency) ??
    "";
  const labels = [
    ["Order total", payment.total_amount ?? payment.total],
    ["Payment", payment.payment],
    ["Original product total", payment.original_total_product_price],
    ["Subtotal", payment.sub_total ?? payment.subtotal],
    ["SKU list price", payment.sku_list_price],
    ["SKU sale price", payment.sku_sale_price],
    ["Shipping list price", payment.shipping_list_price],
    ["Shipping sale price", payment.shipping_sale_price],
    ["Shipping fee", payment.shipping_fee],
    ["Original shipping fee", payment.original_shipping_fee],
    ["Seller discount", payment.seller_discount ?? payment.subtotal_deduction_seller],
    ["Platform discount", payment.platform_discount ?? payment.subtotal_deduction_platform],
    ["Voucher seller discount", payment.voucher_deduction_seller],
    ["Voucher platform discount", payment.voucher_deduction_platform],
    ["Shipping seller discount", payment.shipping_fee_deduction_seller],
    ["Shipping platform discount", payment.shipping_fee_deduction_platform],
    ["Tax", payment.tax ?? payment.tax_amount],
    ["Product tax", payment.product_tax ?? payment.subtotal_tax_amount],
    ["Shipping tax", payment.shipping_fee_tax],
    ["Net price", payment.net_price_amount],
  ];

  return {
    orderId: getString(payload.orderId) ?? getString(source.order_id) ?? "",
    currency,
    totals: labels
      .map(([label, amount]) => ({ label: String(label), amount: getAmountString(amount) }))
      .filter((item) => item.amount),
    lineItems: lineItems.map(normalizeLineItem),
  };
}

function normalizeReferences(raw: unknown) {
  const data = isRecord(raw) && isRecord(raw.data) ? raw.data : raw;
  const source = getRecord(data) ?? {};
  const values = Array.isArray(source.external_order_references)
    ? source.external_order_references
    : Array.isArray(source.references)
      ? source.references
      : Array.isArray(source.orders)
        ? source.orders
        : [];

  return values.map((item) => {
    const row = getRecord(item) ?? {};
    return {
      orderId: getString(row.order_id) ?? getString(row.id) ?? "",
      externalReference: getString(row.external_order_reference) ?? getString(row.reference) ?? "",
      createdAt: formatUnixTime(row.create_time),
      updatedAt: formatUnixTime(row.update_time),
    };
  });
}

function normalizeLineItem(value: unknown) {
  const item = getRecord(value) ?? {};
  const salePrice =
    getRecord(item.sale_price) ??
    getRecord(item.price) ??
    getRecord(item.original_price) ??
    getRecord(item.sku_price) ??
    getRecord(item.total_price) ??
    {};
  return {
    id: getString(item.id) ?? getString(item.line_item_id) ?? "",
    productName: getString(item.product_name) ?? "",
    skuName: getString(item.sku_name) ?? getString(item.seller_sku) ?? "",
    quantity: getNumber(item.quantity) ?? undefined,
    displayStatus: getString(item.display_status) ?? "",
    price:
      getAmountString(salePrice.amount) ||
      getAmountString(item.sale_price) ||
      getAmountString(item.sku_sale_price) ||
      getAmountString(item.payment) ||
      getAmountString(item.subtotal) ||
      getAmountString(item.total) ||
      getAmountString(item.price) ||
      getAmountString(item.original_price) ||
      getAmountString(item.sku_price) ||
      getAmountString(item.sku_list_price) ||
      "",
    currency:
      getString(salePrice.currency) ??
      getString(item.currency) ??
      getString(item.currency_code) ??
      "",
  };
}

function normalizePackage(value: unknown) {
  const item = getRecord(value) ?? {};
  return {
    id: getString(item.id) ?? getString(item.package_id) ?? "",
    deliveryOptionName: getString(item.delivery_option_name) ?? "",
    shippingProvider: getString(item.shipping_provider_name) ?? "",
    trackingNumber: getString(item.tracking_number) ?? "",
  };
}

function normalizePayment(payment: Record<string, unknown>) {
  return {
    currency: getString(payment.currency) ?? getString(payment.currency_code) ?? "",
    totalAmount: getString(payment.total_amount) ?? "",
    shippingFee: getString(payment.shipping_fee) ?? "",
    subTotal: getString(payment.sub_total) ?? "",
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
  method: TikTokApiRequest["method"],
  path: string,
  query: Record<string, string>,
  body: Record<string, unknown>,
  tokenRefreshed: boolean,
) {
  return {
    method,
    path,
    query: sanitizeDebugRecord(query),
    body: sanitizeDebugRecord(body),
    baseUrl,
    tokenRefreshed,
    requestedAt: new Date().toISOString(),
  };
}

function getRawApiRequest(payload: Record<string, unknown>): TikTokApiRequest {
  const method = payload.method === "GET" ? "GET" : "POST";
  const path = requireCleanString(payload.path, "path");
  if (!path.startsWith("/order/")) throw new Error("Raw API Console only allows /order/ TikTok Shop paths.");

  return {
    method,
    path,
    query: sanitizeStringRecord(payload.query),
    body: sanitizeBodyRecord(payload.body),
  };
}

function sanitizeStringRecord(value: unknown) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, rawValue]) => [sanitizeToken(key), sanitizeToken(rawValue)] as const)
      .filter(([key, rawValue]) => key && rawValue),
  );
}

function sanitizeBodyRecord(value: unknown) {
  if (!isRecord(value)) return {};
  return value;
}

function sanitizeDebugRecord(value: Record<string, unknown>) {
  const sensitive = new Set(["app_key", "shop_cipher", "access_token", "refresh_token", "sign", "app_secret"]);
  return Object.fromEntries(
    Object.entries(value).map(([key, rawValue]) => [
      key,
      sensitive.has(key.toLowerCase()) && typeof rawValue === "string" ? maskValue(rawValue) : rawValue,
    ]),
  );
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

function isTikTokApiError(raw: unknown) {
  if (!isRecord(raw) || !("code" in raw)) return false;
  const code = getNumber(raw.code);
  return code !== null && code !== 0;
}

function formatUnixTime(value: unknown) {
  const seconds = getNumber(value);
  if (!seconds) return "";
  return new Date(seconds * 1000).toISOString();
}

function requireCleanString(value: unknown, label: string) {
  const clean = sanitizeToken(value);
  if (!clean) throw new Error(`Missing ${label}`);
  return clean;
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function getArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getAmountString(value: unknown) {
  if (isRecord(value)) return getString(value.amount) ?? getString(value.value) ?? "";
  return getString(value) ?? "";
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

function getBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  return false;
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
