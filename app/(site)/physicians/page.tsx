import GutguardSite from "@/components/GutguardSite";

export const metadata = {
  title: "For Physicians",
  description: "The Gutguard measured protocol and founding physician program.",
};

export default function PhysiciansPage() {
  return <GutguardSite initialRoute="/physicians" />;
}
