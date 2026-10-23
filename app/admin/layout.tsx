import { Suspense } from "react";
import AdminShell from "@/components/admin/AdminShell";

export const metadata = {
  title: "Admin Operations CRM | GutGuard",
  description: "Operations, partner management, and commerce console for GutGuard.",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
