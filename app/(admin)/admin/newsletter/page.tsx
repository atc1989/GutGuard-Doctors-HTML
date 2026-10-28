import AdminWheelPage from "@/app/(admin)/admin/wheel/page";

export const metadata = {
  title: "Newsletter Broadcast | GutGuard CRM",
  description: "Send HTML newsletters and view delivery history for partner doctors.",
};

export default function NewsletterAdminPage() {
  return <AdminWheelPage defaultTab="newsletter" />;
}
