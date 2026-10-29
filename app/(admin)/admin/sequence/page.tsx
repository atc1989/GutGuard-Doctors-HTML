import EmailSequence from "@/components/admin/EmailSequence";

export const metadata = {
  title: "Email Onboarding Sequence | GutGuard CRM",
  description: "Configure automated onboarding email sequence steps and inspect partner progress.",
};

export default function SequenceAdminPage() {
  return <EmailSequence />;
}
