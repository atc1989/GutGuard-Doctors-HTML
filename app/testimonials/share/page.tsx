import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import TestimonialForm from "@/components/TestimonialForm";

export const metadata = {
  title: "Share your story",
  description: "Tell us what changed over your 90 days — in your words, with your photos or video.",
  // A submission form has nothing to rank for, and the wall itself is the page worth indexing.
  robots: { index: false, follow: true },
};

export default function ShareTestimonialPage() {
  return (
    <main className="tm-shell">
      <SiteNav />

      <div className="tm-page narrow">
        <header className="tm-hero">
          <div className="tm-eyebrow">
            <Link href="/testimonials">Member stories</Link>
          </div>
          <h1>
            Your 90 days. <em>Your words.</em>
          </h1>
          <p>
            Write it the way you would tell a friend. A person reads every story before it goes up,
            so nothing appears until you hear from us.
          </p>
        </header>

        <TestimonialForm />

        <p className="tm-caveat">
          Please share only your own experience. We cannot publish stories that describe treating,
          curing, or preventing a disease, or that name another person without their permission.
        </p>
      </div>
    </main>
  );
}
