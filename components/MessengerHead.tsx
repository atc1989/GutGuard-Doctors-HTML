"use client";

import { usePathname } from "next/navigation";
import { LINKS } from "@/lib/constants";

// Meta retired the embedded Customer Chat plugin in 2024; m.me opens the app on phones.
export default function MessengerHead() {
  const path = usePathname();
  if (/^\/(admin|partner|system)(\/|$)/.test(path)) return null;
  return (
    <a
      className="messenger-head"
      href={LINKS.messenger}
      target="_blank"
      rel="noopener"
      aria-label="Chat with Gutguard on Messenger"
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
        <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17V22l2.98-1.64c.84.23 1.73.36 2.66.36h.22c5.64 0 10-4.13 10-9.7S17.64 2 12 2Zm1.04 12.96-2.55-2.72-4.97 2.72 5.47-5.8 2.6 2.72 4.92-2.72-5.47 5.8Z" />
      </svg>
    </a>
  );
}
