import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.2";

const SITE_URL = (Deno.env.get("SHOP_SITE_URL") ?? "https://gutguard.ph").replace(/\/$/, "");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** "saved" is the order-received email; "paid" is the receipt fired by the Maya webhook. */
type EmailKind = "saved" | "paid";

type RequestPayload = {
  orderId?: string;
  kind?: EmailKind;
};

type ShopOrder = {
  id: string;
  order_code: string;
  customer_name: string | null;
  email: string | null;
  mobile: string | null;
  subtotal: number | string | null;
  shipping_fee: number | string | null;
  total_amount: number | string | null;
  address: string | null;
  barangay: string | null;
  city: string | null;
  province: string | null;
  zip: string | null;
  items: Array<{ name?: string; qty?: number; price?: number }> | null;
  created_at: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { orderId, kind = "saved" } = (await req.json()) as RequestPayload;
    if (!orderId) return jsonResponse({ error: "Missing orderId" }, 400);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("SHOP_ORDER_FROM_EMAIL") ?? "GutGuard Orders <onboarding@resend.dev>";
    const replyTo = Deno.env.get("SHOP_ORDER_REPLY_TO") ?? undefined;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!resendApiKey || !supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Missing Edge Function secrets" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await supabase
      .from("shop_orders")
      .select("id, order_code, customer_name, email, mobile, address, barangay, city, province, zip, subtotal, shipping_fee, total_amount, items, created_at")
      .eq("id", orderId)
      .single();

    if (error || !data) return jsonResponse({ error: "Order not found" }, 404);

    const order = data as ShopOrder;
    const email = (order.email ?? "").trim().toLowerCase();
    const subject =
      kind === "paid"
        ? `Payment confirmed for GutGuard order ${order.order_code}`
        : `We received your GutGuard order ${order.order_code}`;

    if (!isValidEmail(email)) {
      await recordSendAttempt(supabase, {
        orderId,
        email,
        subject,
        status: "skipped",
        errorMessage: "Missing or invalid email address",
      });
      return jsonResponse({ sent: false, skipped: true });
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject,
        html: renderEmail(order, kind),
        reply_to: replyTo,
      }),
    });

    const resendBody = await resendResponse.json();
    if (!resendResponse.ok) {
      const message = stringifyError(resendBody);
      await recordSendAttempt(supabase, {
        orderId,
        email,
        subject,
        status: "failed",
        errorMessage: message,
      });
      return jsonResponse({ error: "Email send failed", details: resendBody }, 502);
    }

    await recordSendAttempt(supabase, {
      orderId,
      email,
      subject,
      status: "sent",
      resendId: resendBody.id,
    });

    return jsonResponse({ sent: true, resendId: resendBody.id });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});

async function recordSendAttempt(
  supabase: ReturnType<typeof createClient>,
  input: {
    orderId: string;
    email: string;
    subject: string;
    status: "sent" | "failed" | "skipped";
    resendId?: string | null;
    errorMessage?: string | null;
  },
) {
  await supabase.from("shop_order_email_sends").insert({
    order_id: input.orderId,
    email: input.email,
    subject: input.subject,
    status: input.status,
    resend_id: input.resendId ?? null,
    error_message: input.errorMessage ?? null,
  });
}

function renderEmail(order: ShopOrder, kind: EmailKind) {
  const isPaid = kind === "paid";
  const orderUrl = `${SITE_URL}/shop/order/${encodeURIComponent(order.order_code)}`;
  const items = Array.isArray(order.items) ? order.items : [];
  const itemRows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #E5E0D2;">${escapeHtml(item.name ?? "GutGuard item")}</td>
          <td style="padding:10px 0;border-bottom:1px solid #E5E0D2;text-align:center;">${item.qty ?? 1}</td>
          <td style="padding:10px 0;border-bottom:1px solid #E5E0D2;text-align:right;">${formatPeso(Number(item.price ?? 0))}</td>
        </tr>`,
    )
    .join("");

  return `
    <div style="margin:0;padding:0;background:#F4F1EA;color:#141019;font-family:Arial,sans-serif;">
      <div style="max-width:620px;margin:0 auto;padding:32px 20px;">
        <div style="background:#FCFAF5;border:1px solid #D8D2C2;padding:28px;">
          <p style="margin:0 0 10px;color:#0608A9;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">${isPaid ? "Payment confirmed" : "Order received"}</p>
          <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:34px;font-weight:400;line-height:1.05;">${isPaid ? "Payment received. Thank you." : "We received your GutGuard order."}</h1>
          <p style="margin:0 0 18px;color:#3A3A48;font-size:16px;line-height:1.55;">Hi ${escapeHtml(order.customer_name ?? "there")}, ${
            isPaid
              ? `we have confirmed payment for order <strong>${escapeHtml(order.order_code)}</strong>.`
              : `your order <strong>${escapeHtml(order.order_code)}</strong> has been saved.`
          }</p>
          <p style="margin:0 0 22px;color:#3A3A48;font-size:16px;line-height:1.55;">${
            isPaid
              ? "Our admin team will call you to confirm delivery details before we ship."
              : "Complete payment on Maya to reserve your stock - card, Maya wallet, QRPh, or online banking. Your order page below always has an up-to-date payment link."
          }</p>
          <a href="${orderUrl}" style="display:inline-block;background:#0608A9;color:#F4F1EA;text-decoration:none;padding:14px 18px;font-weight:800;">${isPaid ? "View your order" : "View order and pay"}</a>
          <table style="width:100%;border-collapse:collapse;margin-top:26px;font-size:14px;">
            <thead>
              <tr>
                <th style="padding:0 0 8px;text-align:left;color:#6B6B7A;font-size:10px;letter-spacing:.14em;text-transform:uppercase;">Item</th>
                <th style="padding:0 0 8px;text-align:center;color:#6B6B7A;font-size:10px;letter-spacing:.14em;text-transform:uppercase;">Qty</th>
                <th style="padding:0 0 8px;text-align:right;color:#6B6B7A;font-size:10px;letter-spacing:.14em;text-transform:uppercase;">Price</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
          <div style="margin-top:20px;border-top:1px solid #E5E0D2;padding-top:14px;color:#3A3A48;font-size:14px;line-height:1.6;">
            <p style="margin:0;text-align:right;">Subtotal ${formatPeso(Number(order.subtotal ?? 0))}</p>
            <p style="margin:0;text-align:right;">Shipping ${formatPeso(Number(order.shipping_fee ?? 0))}</p>
            <p style="margin:8px 0 0;text-align:right;font-family:Georgia,serif;font-size:24px;color:#141019;">Total ${formatPeso(Number(order.total_amount ?? order.subtotal ?? 0))}</p>
          </div>
          <p style="margin:22px 0 0;color:#3A3A48;font-size:14px;line-height:1.55;"><strong>Delivery address:</strong><br>${escapeHtml(formatDeliveryAddress(order))}</p>
          <p style="margin:26px 0 0;color:#6B6B7A;font-size:13px;line-height:1.5;">${
            isPaid
              ? "Keep this email for your records. Reply here if anything about the order looks wrong."
              : "Maya payment sessions expire after an hour, so always start payment from your order page rather than an old link."
          }</p>
        </div>
      </div>
    </div>`;
}

function formatPeso(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);
}

function formatDeliveryAddress(order: ShopOrder) {
  return [order.address, order.barangay, order.city, order.province, order.zip].filter(Boolean).join(", ");
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function stringifyError(value: unknown) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "Email send failed";
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
