import AdminWheelPage from "@/app/(admin)/admin/wheel/page";

export const metadata = {
  title: "Email Onboarding Sequence | GutGuard CRM",
  description: "Configure automated onboarding email sequence steps and inspect partner progress.",
};

export default function SequenceAdminPage() {
  return <AdminWheelPage defaultTab="sequence" />;
}
