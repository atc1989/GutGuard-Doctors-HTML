import PartnerPortal from "@/components/PartnerPortal";

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
  const referrerSlug = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase() ?? "";

  return <PartnerPortal initialView="apply" referrerSlug={referrerSlug} />;
}
