"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckIcon } from "@/components/Icons";
import { getPublicShopOrder, startMayaCheckout, type PublicShopOrder } from "@/lib/api";

// Maya redirects here with ?p=success|failure|cancel. That flag only picks the opening
// copy - the payment result itself always comes from the webhook-written row, because
// a customer can close the Maya tab before the redirect ever fires.
type ReturnFlag = "success" | "failure" | "cancel" | null;

const POLL_INTERVAL_MS = 2000;
const POLL_ATTEMPTS = 10;

const peso = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);

export default function OrderStatus({ orderCode }: { orderCode: string }) {
  const searchParams = useSearchParams();
  const returnFlag = normalizeFlag(searchParams.get("p"));

  const [order, setOrder] = useState<PublicShopOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(returnFlag === "success");
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState("");
  const pollsLeft = useRef(returnFlag === "success" ? POLL_ATTEMPTS : 0);

  const load = useCallback(async () => {
    const fetched = await getPublicShopOrder(orderCode);
    setOrder(fetched);
    return fetched;
  }, [orderCode]);

  useEffect(() => {
    let cancelled = false;

    load()
      .then((fetched) => {
        if (cancelled) return;
        if (fetched?.payment_status === "paid") {
          pollsLeft.current = 0;
          setIsConfirming(false);
        }
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Order could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [load]);

  // Maya redirects the customer back before (or racing with) the server-to-server webhook,
  // so a "success" return waits a few seconds for the row to settle rather than guessing.
  useEffect(() => {
    if (!isConfirming || pollsLeft.current <= 0) return;

    const timer = window.setTimeout(async () => {
      pollsLeft.current -= 1;
      try {
        const fetched = await load();
        if (fetched?.payment_status === "paid" || pollsLeft.current <= 0) setIsConfirming(false);
      } catch {
        setIsConfirming(false);
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearTimeout(timer);
  }, [isConfirming, order, load]);

  async function payNow() {
    if (!order) return;
    setIsPaying(true);
    setError("");

    try {
      const result = await startMayaCheckout(order.order_id);
      if (result.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Payment could not be started.");
    } finally {
      setIsPaying(false);
    }
  }

  if (isLoading) {
    return (
      <main className="shop-shell">
        <OrderNav />
        <section className="shop-order-panel" aria-busy="true">
          <p className="shop-kicker">Loading</p>
          <h1>Fetching your order</h1>
        </section>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="shop-shell">
        <OrderNav />
        <section className="shop-order-panel">
          <p className="shop-kicker">Not found</p>
          <h1>We could not find order {orderCode}.</h1>
          <p className="shop-lede">Check the link in your email, or start a new order.</p>
          <Link className="shop-primary" href="/shop">
            <span>Back to the shop</span>
          </Link>
        </section>
      </main>
    );
  }

  const isPaid = order.payment_status === "paid";
  const view = getView(order, returnFlag, isConfirming);

  return (
    <main className="shop-shell">
      <OrderNav />

      <section className={`shop-order-panel ${view.tone}`}>
        {isPaid ? <CheckIcon /> : null}
        <p className="shop-kicker">{view.kicker}</p>
        <h1>{view.headline}</h1>
        <p className="shop-lede">{view.body}</p>

        <dl className="shop-order-meta">
          <div>
            <dt>Order</dt>
            <dd>{order.order_code}</dd>
          </div>
          <div>
            <dt>Placed</dt>
            <dd>{formatDate(order.created_at)}</dd>
          </div>
          <div>
            <dt>Confirmation sent to</dt>
            <dd>{order.email_masked}</dd>
          </div>
          {order.maya_reference ? (
            <div>
              <dt>Maya reference</dt>
              <dd>{order.maya_reference}</dd>
            </div>
          ) : null}
        </dl>

        {error ? <div className="shop-error">{error}</div> : null}

        {view.showPayButton ? (
          <button type="button" className="shop-primary" onClick={payNow} disabled={isPaying}>
            <span>
              {isPaying ? "Opening secure Maya checkout" : `Pay ${peso(order.total_amount)} with Maya`}
              <small>Card, Maya wallet, QRPh or online banking</small>
            </span>
          </button>
        ) : null}

        {isConfirming ? <p className="shop-note">Confirming your payment with Maya. This usually takes a few seconds.</p> : null}
      </section>

      <section className="shop-order-panel">
        <p className="shop-kicker">Summary</p>
        <div className="shop-lines">
          {order.items.map((item) => (
            <article className="shop-line" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>
                  {item.caps} capsules - {peso(item.price)}
                </span>
              </div>
              <span>x{item.qty}</span>
              <b>{peso(item.price * item.qty)}</b>
            </article>
          ))}
          <div className="shop-total">
            <span>Subtotal</span>
            <strong>{peso(order.subtotal)}</strong>
          </div>
          <div className="shop-total">
            <span>Shipping {order.shipping_region ? `(${order.shipping_region})` : ""}</span>
            <strong>{order.shipping_fee ? peso(order.shipping_fee) : "For review"}</strong>
          </div>
          <div className="shop-total grand">
            <span>Total</span>
            <strong>{peso(order.total_amount)}</strong>
          </div>
        </div>
      </section>
    </main>
  );
}

function OrderNav() {
  return (
    <nav className="shop-nav" aria-label="Shop header">
      <Link className="shop-brand" href="/">
        <Image src="/gutguard-logo.png" alt="GutGuard" width={34} height={40} priority />
        <span>GutGuard</span>
      </Link>
      <Link className="shop-nav-link" href="/shop">
        Back to shop
      </Link>
    </nav>
  );
}

function getView(order: PublicShopOrder, flag: ReturnFlag, isConfirming: boolean) {
  if (order.payment_status === "paid") {
    return {
      tone: "paid",
      kicker: "Paid",
      headline: `Payment received, ${order.first_name}.`,
      body: "Our admin team will call you to confirm delivery details before we ship. Keep this page for your reference.",
      showPayButton: false,
    };
  }

  if (order.status === "cancelled") {
    return {
      tone: "cancelled",
      kicker: "Cancelled",
      headline: "This order was cancelled.",
      body: "The payment window expired or the order was cancelled. You can place a new order any time.",
      showPayButton: false,
    };
  }

  if (isConfirming) {
    return {
      tone: "pending",
      kicker: "Confirming",
      headline: "Checking your payment.",
      body: "Maya is confirming the transaction. This page updates on its own.",
      showPayButton: false,
    };
  }

  if (flag === "failure" || order.payment_status === "failed") {
    return {
      tone: "failed",
      kicker: "Payment failed",
      headline: "That payment did not go through.",
      body: "Nothing was charged and your order is still saved. Try again with the same or a different payment method.",
      showPayButton: true,
    };
  }

  if (flag === "cancel") {
    return {
      tone: "pending",
      kicker: "Cancelled at Maya",
      headline: "You stopped the payment.",
      body: "Your order is still saved and nothing was charged. Pay whenever you are ready.",
      showPayButton: true,
    };
  }

  return {
    tone: "pending",
    kicker: "Awaiting payment",
    headline: `Order ${order.order_code} is saved.`,
    body: "Complete payment to reserve your stock. We only ship after payment is confirmed.",
    showPayButton: true,
  };
}

function normalizeFlag(value: string | null): ReturnFlag {
  return value === "success" || value === "failure" || value === "cancel" ? value : null;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(date);
}
