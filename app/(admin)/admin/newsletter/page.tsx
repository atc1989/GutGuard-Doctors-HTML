import AdminMessaging from "@/components/admin/AdminMessaging";

export const metadata = {
  title: "Newsletter Broadcast | GutGuard CRM",
  description: "Send HTML newsletters and view delivery history for partner doctors.",
};

export default function NewsletterAdminPage() {
  return <AdminMessaging tab="newsletter" />;
}
