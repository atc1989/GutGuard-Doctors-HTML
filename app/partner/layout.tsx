import { Suspense } from "react";
import PartnerPortal from "@/components/PartnerPortal";

export const metadata = {
  title: "Partner dashboard",
  description: "Track your Gutguard referral link, clicks and orders.",
  robots: { index: false, follow: false },
};

// PartnerPortal owns sign-in and stays mounted across the partner pages, so moving between
// them does not refetch the dashboard.
export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <PartnerPortal>{children}</PartnerPortal>
    </Suspense>
  );
}
