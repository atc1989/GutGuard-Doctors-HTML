import RegistrationExperience from "@/components/RegistrationExperience";

export const metadata = {
  title: "Physician registration",
  description: "Register for the Gutguard physician and clinical adopter program.",
};

type PhysicianRegistrationPageProps = {
  searchParams: Promise<{ ref?: string | string[] }>;
};

export default async function PhysicianRegistrationPage({ searchParams }: PhysicianRegistrationPageProps) {
  const params = await searchParams;
  const raw = params.ref;
  const referrerSlug = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase() ?? "";

  return <RegistrationExperience referrerSlug={referrerSlug} />;
}
