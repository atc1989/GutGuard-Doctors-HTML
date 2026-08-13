import RegistrationExperience from "@/components/RegistrationExperience";
import { cookies } from "next/headers";

export const metadata = {
  title: "Physician registration | GutGuard",
  description: "Register for the GutGuard physician and clinical adopter program.",
};

export default async function PhysicianRegistrationPage({ searchParams }: { searchParams: Promise<{ ref?: string; invitation?: string }> }) {
  const params = await searchParams;
  const cookieSlug = (await cookies()).get("gg_partner_ref")?.value ?? "";
  return <RegistrationExperience initialReferrerSlug={params.ref ?? cookieSlug} initialInvitationInvalid={params.invitation === "invalid"} />;
}
