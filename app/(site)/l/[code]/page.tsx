import type { Metadata } from "next";
import { LandingShell } from "@/components/GutguardSite";
import { LANDING_BODY, LANDING_CSS } from "@/lib/landing/patient-landing";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const SHOP_ORIGIN = (process.env.NEXT_PUBLIC_SHOP_URL ?? "https://shop.gutguard.ph").replace(/\/$/, "");

export const metadata: Metadata = {
  title: { absolute: "SynBIOTIC+ · Gutguard" },
  description: "Your doctor recommended SynBIOTIC+. How to order it, how to take it, and why it is worth it.",
  openGraph: {
    title: "Your doctor recommended SynBIOTIC+",
    description: "How to order it and how to take it. Order in 2 minutes. Delivered to your home.",
  },
  // One copy of this page per partner code - keep them out of search.
  robots: { index: false },
};

async function lookUp(code: string) {
  if (!/^\d{1,9}$/.test(code) || !supabase) return { known: false, canRefer: false };
  const slug = (await supabase.rpc("partner_slug_by_code", { p_code: code })).data;
  if (typeof slug !== "string" || !slug) return { known: false, canRefer: false };
  // Locked affiliates can't recruit yet - the same rule as the share page and the shop's
  // "Become a partner" (get_partner_invitation.can_refer).
  const { data } = await supabase.rpc("get_partner_invitation", { p_slug: slug });
  const invitation = Array.isArray(data) ? data[0] : data;
  return { known: true, canRefer: invitation?.can_refer === true };
}

/**
 * Landing link on partner posters: /l/<code> -> the patient landing page. Its Buy now buttons
 * (top bar, hero, buy bar) and Join buttons are that partner's /s/ and /j/ links, so the credit
 * follows the patient. Unknown codes still get the page, with the plain shop and register links.
 */
export default async function LandingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { known, canRefer } = await lookUp(code);
  const shop = known ? `/s/${code}` : `${SHOP_ORIGIN}/shop`;
  const join = canRefer ? `/j/${code}` : "/physicians/register";

  const body = LANDING_BODY.replaceAll("{{SHOP_URL}}", shop)
    .replaceAll("{{JOIN_URL}}", join)
    .replace("{{REF_NOTE}}", known ? `<p class="sec-sub">Ref. No. #${code} is applied automatically in the shop.</p>` : "");

  return (
    // Locked affiliates keep Log in in the top bar, like their shop does.
    <LandingShell shop={shop} join={join} recruit={!known || canRefer} css={LANDING_CSS}>
      <div dangerouslySetInnerHTML={{ __html: body }} />
    </LandingShell>
  );
}
