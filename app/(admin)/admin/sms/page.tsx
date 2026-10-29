import AdminMessaging from "@/components/admin/AdminMessaging";

export const metadata = {
  title: "SMS Blast | GutGuard CRM",
  description: "Send direct SMS announcements to partner doctors and view dispatch records.",
};

export default function SmsAdminPage() {
  return <AdminMessaging tab="sms" />;
}
