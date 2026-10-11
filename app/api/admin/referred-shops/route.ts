import { NextResponse } from "next/server";
import { adminErrorMessage } from "@/lib/admin-error";
import { getAdminPasswordFromSession } from "@/lib/admin-session";
import { supabaseAdmin, supabaseAdminShop } from "@/lib/supabase-admin";

export type AdminShop = {
  id: string;
  name: string;
  address: string;
  mobile: string;
  email: string;
  specialty: string;
  storeType: string;
  referrerId: string | null;
  referrerName: string;
  referrerStoreType: string;
  mainStoreName: string;
  joinedAt: string;
  orders: number;
  sales: number;
};

type PartnerRow = {
  id: string;
  name_prefix: string | null;
  full_name: string | null;
  email: string | null;
  mobile: string | null;
  specialty: string | null;
  practice_location: string | null;
  store_type: string | null;
  referred_by_partner_id: string | null;
  main_store_id: string | null;
  created_at: string;
};

type OrderRow = {
  referral_doctor_id: string;
  payment_status: string | null;
  total_amount: number | string | null;
  subtotal: number | string | null;
  shipping_fee: number | string | null;
};

const PAGE = 1000; // PostgREST's default row cap

/** Every row of a query, page by page - orders outgrow one response. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

const fullName = (row: Pick<PartnerRow, "name_prefix" | "full_name"> | undefined) =>
  row ? [row.name_prefix, row.full_name].map((part) => (part ?? "").trim()).filter(Boolean).join(" ") : "";

/**
 * Every partner shop (all store types, referred or not) with its owner, clinic address,
 * referrer, main store, and orders / paid sales through the shop's own link. Orders and
 * sales use the same definitions as the partner dashboard's "Referred partners" page, so
 * admin and partners see the same numbers.
 */
export async function GET() {
  if (!(await getAdminPasswordFromSession())) {
    return NextResponse.json({ error: "Unauthorized: Admin session expired." }, { status: 401 });
  }
  if (!supabaseAdmin || !supabaseAdminShop) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  try {
    // Partners always live in `doctors`; orders live in the shop schema (doctors | sandbox).
    const [partners, orders] = await Promise.all([
      fetchAll<PartnerRow>((from, to) =>
        supabaseAdmin!
          .from("doctor_registrations")
          .select(
            "id, name_prefix, full_name, email, mobile, specialty, practice_location, store_type, referred_by_partner_id, main_store_id, created_at",
          )
          .order("created_at", { ascending: false })
          .range(from, to),
      ),
      fetchAll<OrderRow>((from, to) =>
        supabaseAdminShop!
          .from("shop_orders")
          .select("referral_doctor_id, payment_status, total_amount, subtotal, shipping_fee")
          .not("referral_doctor_id", "is", null)
          .order("id")
          .range(from, to),
      ),
    ]);

    const byId = new Map(partners.map((partner) => [partner.id, partner]));
    const totals = new Map<string, { orders: number; sales: number }>();
    for (const order of orders) {
      const entry = totals.get(order.referral_doctor_id) ?? { orders: 0, sales: 0 };
      entry.orders += 1;
      if (order.payment_status === "paid") {
        entry.sales +=
          Number(order.total_amount) || Number(order.subtotal ?? 0) + Number(order.shipping_fee ?? 0);
      }
      totals.set(order.referral_doctor_id, entry);
    }

    const shops: AdminShop[] = partners.map((partner) => {
      const referrer = partner.referred_by_partner_id ? byId.get(partner.referred_by_partner_id) : undefined;
      const mainStore = partner.main_store_id ? byId.get(partner.main_store_id) : undefined;
      const total = totals.get(partner.id) ?? { orders: 0, sales: 0 };
      return {
        id: partner.id,
        name: fullName(partner),
        address: (partner.practice_location ?? "").trim(),
        mobile: partner.mobile ?? "",
        email: partner.email ?? "",
        specialty: partner.specialty ?? "",
        storeType: partner.store_type ?? "affiliate",
        referrerId: partner.referred_by_partner_id,
        referrerName: fullName(referrer),
        referrerStoreType: referrer?.store_type ?? "",
        mainStoreName: fullName(mainStore),
        joinedAt: partner.created_at,
        orders: total.orders,
        sales: total.sales,
      };
    });

    return NextResponse.json({ shops });
  } catch (error) {
    return NextResponse.json({ error: adminErrorMessage(error, "Failed to load shops.") }, { status: 500 });
  }
}
