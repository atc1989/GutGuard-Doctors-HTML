import { Suspense } from "react";
import OrderStatus from "@/components/OrderStatus";

export const metadata = {
  title: "Your order",
  description: "Track your Gutguard order and complete payment.",
};

export default async function ShopOrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  return (
    <Suspense fallback={null}>
      <OrderStatus orderCode={decodeURIComponent(code)} />
    </Suspense>
  );
}
