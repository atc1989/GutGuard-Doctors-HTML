import DoctorPartners from "@/components/admin/DoctorPartners";

export const metadata = {
  title: "Doctor Registrations | GutGuard CRM",
  description: "Manage registered doctor partners, QR codes, and clinic tiers.",
};

export default function DoctorsAdminPage() {
  return <DoctorPartners />;
}
