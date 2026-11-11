/*
 * One SMS adapter for every function that texts somebody, plus the customer-facing copy.
 *
 * `SMS_PROVIDER` picks the adapter and the provider's own secrets configure it. The type and
 * the secret names are the ones `send-sms-blast` has always used, so the doctor blast kept
 * working when its inlined adapter moved in here.
 *
 * Nothing reads `Deno.env` at module level, so the pure half - the copy - can be imported and
 * tested by the node test runner (`sms.test.ts`). Keep it that way.
 */

export type SmsProvider = {
  name: string;
  /** Resolves to the provider's message id, or null when it does not give one. */
  send: (input: { to: string; message: string }) => Promise<string | null>;
};

/**
 * Which secret picks the adapter for a schema. Production reads `SMS_PROVIDER` and sends for
 * real; every other schema reads `SANDBOX_SMS_PROVIDER`, so a sandbox test cannot spend credits
 * or text a real customer just because production is live. Both schemas live in one Supabase
 * project and therefore share one set of secrets, which is why the names have to differ.
 *
 * Unset means that schema sends nothing at all - the safe default, and what sandbox gets until
 * somebody sets it.
 */
export function smsProviderEnvVar(schema: string): string {
  return schema === "doctors" ? "SMS_PROVIDER" : "SANDBOX_SMS_PROVIDER";
}

/** null when the secret is unset: the caller skips SMS and behaves exactly as before. */
export function getSmsProvider(envVar = "SMS_PROVIDER"): SmsProvider | null {
  const providerName = (Deno.env.get(envVar) ?? "").trim().toLowerCase();
  if (!providerName) return null;

  if (providerName === "semaphore") return getSemaphoreProvider();
  if (providerName === "log") return getLogProvider();
  if (["itexmo", "itexmo.com"].includes(providerName)) return getItexmoProvider();

  return {
    name: providerName,
    send() {
      throw new Error(`SMS provider adapter "${providerName}" is not implemented yet.`);
    },
  };
}

/**
 * `SMS_PROVIDER=log`: writes the message to the function log and reports success without
 * sending anything. For exercising the rest of the path - the right wording, the right number,
 * and above all one text per order and kind - without spending credits.
 *
 * Every send shouts, because silently delivering nothing is exactly what it looks like when
 * someone leaves it switched on by mistake.
 */
function getLogProvider(): SmsProvider {
  return {
    name: "log",
    send({ to, message }) {
      console.warn(`SMS_PROVIDER=log: NOT SENT. To ${to} (${message.length} ch): ${message}`);
      return Promise.resolve(`log-${crypto.randomUUID()}`);
    },
  };
}

/**
 * Semaphore (semaphore.co), the Philippine gateway. Form-encoded POST, JSON array back.
 *
 * `number` takes `09XXXXXXXXX` exactly as the shop stores it, so there is nothing to convert.
 * Sending fails unless `sendername` is an approved Sender Name on the account ("Gutguard",
 * approved 2026-11-07); Semaphore removed the shared fallback sender, so there is no default.
 */
function getSemaphoreProvider(): SmsProvider {
  const endpoint = (Deno.env.get("SEMAPHORE_ENDPOINT") ?? "https://api.semaphore.co/api/v4/messages").trim();

  return {
    name: "semaphore",
    async send({ to, message }) {
      const apiKey = (Deno.env.get("SEMAPHORE_API_KEY") ?? "").trim();
      const senderName = (Deno.env.get("SEMAPHORE_SENDER_NAME") ?? "").trim();
      if (!apiKey) throw new Error("SEMAPHORE_API_KEY is not configured.");
      if (!senderName) throw new Error("SEMAPHORE_SENDER_NAME is not configured.");

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ apikey: apiKey, number: to, message, sendername: senderName }),
      });
      const responseBody = await readResponseBody(response);

      if (!response.ok || isProviderErrorBody(responseBody)) {
        throw new Error(
          getProviderErrorMessage(responseBody) || `Semaphore SMS request failed with HTTP ${response.status}.`,
        );
      }

      return getProviderMessageId(responseBody);
    },
  };
}

/**
 * iTexMo, the doctor blast's original gateway. Kept so `send-sms-blast` is unchanged by the
 * move, but the account is dead: PHP 600 of credits were never usable and its entry tier is now
 * PHP 2,500. Nothing should be pointed at it.
 */
function getItexmoProvider(): SmsProvider {
  const email = (Deno.env.get("ITEXMO_EMAIL") ?? "").trim();
  const password = (Deno.env.get("ITEXMO_PASSWORD") ?? "").trim();
  const apiCode = (Deno.env.get("ITEXMO_API_CODE") ?? "").trim();
  const senderId = (Deno.env.get("ITEXMO_SENDER_ID") ?? "").trim();
  const endpoint = (Deno.env.get("ITEXMO_SMS_ENDPOINT") ?? "https://api.itexmo.com/api/broadcast").trim();

  return {
    name: "itexmo",
    async send({ to, message }) {
      if (!email) throw new Error("ITEXMO_EMAIL is not configured.");
      if (!password) throw new Error("ITEXMO_PASSWORD is not configured.");
      if (!apiCode) throw new Error("ITEXMO_API_CODE is not configured.");

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${email}:${password}`)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ApiCode: apiCode,
          Recipients: [formatItexmoMobile(to)],
          Message: message,
          ...(senderId ? { SenderId: senderId } : {}),
          ClientId: createItexmoClientId(),
        }),
      });
      const responseBody = await readResponseBody(response);

      if (!response.ok || isProviderErrorBody(responseBody)) {
        throw new Error(getProviderErrorMessage(responseBody) || `iTexMo SMS request failed with HTTP ${response.status}.`);
      }

      return getProviderMessageId(responseBody);
    },
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

function isProviderErrorBody(body: unknown) {
  if (!body || typeof body !== "object") return false;
  const value = body as Record<string, unknown>;
  const status = String(value.status ?? value.code ?? value.result ?? "").toLowerCase();
  const failed = Number(value.Failed ?? value.failed ?? 0);
  return (
    status === "error" ||
    status === "failed" ||
    value.success === false ||
    value.Error === true ||
    value.error === true ||
    typeof value.error === "string" ||
    failed > 0
  );
}

function getProviderErrorMessage(body: unknown) {
  if (typeof body === "string") return body;
  if (!body || typeof body !== "object") return "";

  const value = body as Record<string, unknown>;
  for (const key of ["error", "ErrorMessage", "Message", "message", "error_message", "description"]) {
    if (typeof value[key] === "string" && value[key]) return value[key];
  }

  return "";
}

/** Semaphore answers with an array of queued messages; a blast answers with one object. */
function getProviderMessageId(body: unknown): string | null {
  if (Array.isArray(body)) return getProviderMessageId(body[0]);
  if (!body || typeof body !== "object") return null;

  const value = body as Record<string, unknown>;
  for (const key of ["message_id", "messageId", "ReferenceId", "ReferenceID", "referenceId", "reference_id", "id"]) {
    const messageId = value[key];
    if (typeof messageId === "string" || typeof messageId === "number") return String(messageId);
  }

  return null;
}

function formatItexmoMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  if (/^639\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^9\d{9}$/.test(digits)) return `0${digits}`;
  return digits;
}

function createItexmoClientId() {
  return `GG-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`.slice(0, 50);
}

/* ------------------------------------------------------------------ *
 * The copy and the number handling. Pure, so `sms.test.ts` can run it
 * under the node test runner.
 * ------------------------------------------------------------------ */

/** `09XXXXXXXXX`, or "" when the value is not a PH mobile number. */
export function normalizeSmsMobile(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (/^09\d{9}$/.test(digits)) return digits;
  if (/^639\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^9\d{9}$/.test(digits)) return `0${digits}`;
  return "";
}

/**
 * The order kinds that text the customer. "saved" never does - the buyer is still on the site
 * looking at the same words - and the renewal kinds belong to Gutguard Daily, which this system
 * does not have.
 */
export type SmsKind = "paid" | "shipped";

const SMS_KINDS: SmsKind[] = ["paid", "shipped"];

export const textsCustomer = (kind: string): kind is SmsKind => (SMS_KINDS as string[]).includes(kind);

/** Only the order fields the copy needs, so the test does not have to build a whole order. */
export type SmsOrder = {
  order_code: string;
  mobile: string | null;
};

/** One text to send: `to` is `09XXXXXXXXX`, `audience` keys the send-once row with the kind. */
export type OrderSms = { audience: "buyer"; to: string; message: string };

/**
 * Every text this order and kind should send. Returns [] when there is no number to text.
 *
 * Write "PHP", never "P-sign": one non-GSM character turns the whole message into UCS-2 and
 * halves it to 70 characters. `sms.test.ts` holds every message to 160 characters and plain
 * ASCII, which is the only thing standing between a copy edit and a doubled bill.
 */
export function orderSmsMessages(order: SmsOrder, kind: SmsKind, siteUrl: string): OrderSms[] {
  const code = order.order_code;
  const track = `${smsLink(siteUrl)}/shop/order/${encodeURIComponent(code)}`;

  const message = {
    paid: `Gutguard: Payment confirmed. Track order ${code}: ${track}`,
    shipped: `Gutguard: Order ${code} is with the courier. Track it: ${track}`,
  }[kind];

  const mobile = normalizeSmsMobile(order.mobile);
  return mobile ? [{ audience: "buyer", to: mobile, message }] : [];
}

/** The checkout verification text. The code never appears in a log line or a response body. */
export function otpMessage(code: string, minutes: number) {
  return `Gutguard: Your checkout code is ${code}. It expires in ${minutes} minutes. Do not share it.`;
}

/**
 * The site origin as it should appear in an SMS: no trailing slash, and **no scheme**.
 *
 * Smart blocks messages containing a link (Semaphore support, 2026-10-20: send the web address
 * without the https:// prefix). Smart returns no failure for a blocked message, so every one of
 * these would be logged as sent and simply never arrive - for roughly half the country. Phones
 * still linkify a bare "gutguard.ph/...". Never put a shortened link here either.
 */
export function smsLink(siteUrl: string) {
  return siteUrl.replace(/\/$/, "").replace(/^https?:\/\//i, "");
}
