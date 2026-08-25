import PartnerPortal from "@/components/PartnerPortal";

export const metadata = {
  title: "Partner dashboard",
  description: "Track your Gutguard referral link, clicks and orders.",
  robots: { index: false, follow: false },
};

type PartnerPageProps = {
  searchParams: Promise<{ apply?: string | string[]; ref?: string | string[] }>;
};

function firstQueryValue(value?: string | string[]) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default async function PartnerPage({ searchParams }: PartnerPageProps) {
  const params = await searchParams;
  const apply = ["1", "true", "yes"].includes(firstQueryValue(params.apply).toLowerCase());
  const referrerSlug = firstQueryValue(params.ref).toLowerCase();

  return <PartnerPortal initialView={apply ? "apply" : "email"} referrerSlug={referrerSlug} />;
}
