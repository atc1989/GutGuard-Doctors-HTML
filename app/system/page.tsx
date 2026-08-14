import GutguardSite from "@/components/GutguardSite";

export const metadata = {
  title: "The System",
  description: "Learn how Gutguard BioScan, GLIS and MiAge measure your trajectory.",
};

export default function SystemPage() {
  return <GutguardSite initialRoute="/system" />;
}
