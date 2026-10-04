import GutguardSite from "@/components/GutguardSite";

export const metadata = {
  title: "Shop",
  description: "Order Gutguard SynBIOTIC+ online: the 5-Night Watch, packs, and Gutguard Daily.",
  // Addendum 05-A: the Shop has one main address, gutguard.ph/shop. shop.gutguard.ph shows the same
  // Shop and points search engines here (metadataBase in app/layout.tsx is https://gutguard.ph).
  alternates: { canonical: "/shop" },
};

export default function ShopPage() {
  return <GutguardSite initialRoute="/shop" />;
}
