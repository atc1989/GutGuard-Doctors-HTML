import { Suspense } from "react";
import OrderStatus from "@/components/OrderStatus";

export const metadata = {
  title: "Your GutGuard order",
  description: "Track your GutGuard order and complete payment.",
};

export default async function ShopOrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  return (
    <Suspense fallback={null}>
      <OrderStatus orderCode={decodeURIComponent(code)} />
    </Suspense>
  );
}
