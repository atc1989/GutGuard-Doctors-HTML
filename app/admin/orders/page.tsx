import AdminWheelPage from "@/app/admin/wheel/page";

export const metadata = {
  title: "Shop Orders | GutGuard CRM",
  description: "Track online store orders, Maya checkout payments, and partner sales attribution.",
};

export default function OrdersAdminPage() {
  return <AdminWheelPage defaultTab="orders" />;
}
