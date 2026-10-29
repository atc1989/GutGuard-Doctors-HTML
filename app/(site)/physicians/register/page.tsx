import { cookies } from "next/headers";
import PartnerPortal from "@/components/PartnerPortal";
import { REFERRAL_COOKIE } from "@/lib/referral";

export const metadata = {
  title: "Apply to become a partner",
  description: "Register for the Gutguard partner program and open your dashboard.",
};

type PhysicianRegistrationPageProps = {
  searchParams: Promise<{ ref?: string | string[] }>;
};

export default async function PhysicianRegistrationPage({ searchParams }: PhysicianRegistrationPageProps) {
  const params = await searchParams;
  const raw = params.ref;
  // Referral links (app/[slug]/route.ts, /j/<code>) hand the referrer over in a cookie, so the
  // partner's name stays out of the address bar. ?ref= still works for links shared before that.
  // Failing that, the shop's referral cookie: "Become a partner" in a partner's shop credits them.
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get("gg_partner_ref")?.value || cookieStore.get(REFERRAL_COOKIE)?.value || "";
  const referrerSlug = ((Array.isArray(raw) ? raw[0] : raw) || fromCookie).trim().toLowerCase();

  return <PartnerPortal initialView="apply" referrerSlug={referrerSlug} />;
}
