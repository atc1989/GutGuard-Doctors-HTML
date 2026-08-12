import PartnerPortal from "@/components/PartnerPortal";

export const metadata = {
  title: "Partner dashboard | GutGuard",
  description: "Track your GutGuard referral link, clicks and orders.",
  robots: { index: false, follow: false },
};

export default function PartnerPage() {
  return <PartnerPortal />;
}
