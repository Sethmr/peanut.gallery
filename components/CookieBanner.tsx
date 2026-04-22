"use client";

import { useEffect, useState } from "react";

/**
 * Cookie consent banner for the marketing site.
 *
 * Google Analytics is gated by this banner — it only loads after the
 * user clicks Accept. Choice is persisted in localStorage under the
 * `pg-analytics-consent` key with values `granted` or `denied`.
 *
 * The loader function `window.__pgLoadAnalytics` is defined inline in
 * `app/layout.tsx` so it runs before React hydrates. This component
 * only handles the banner UI and persistence.
 */
export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("pg-analytics-consent");
      if (stored !== "granted" && stored !== "denied") {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable — don't show banner
    }
  }, []);

  const choose = (choice: "granted" | "denied") => {
    try {
      localStorage.setItem("pg-analytics-consent", choice);
    } catch {
      // best effort
    }
    setVisible(false);
    if (choice === "granted") {
      const w = window as unknown as { __pgLoadAnalytics?: () => void };
      w.__pgLoadAnalytics?.();
    }
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie preferences"
      className="fixed left-4 right-4 bottom-4 max-w-[560px] mx-auto bg-[#141414] text-[#e5e5e5] border border-[#ff5a1f] rounded px-4 py-3.5 text-[13px] leading-relaxed z-[9999] shadow-[0_8px_24px_rgba(0,0,0,.4)]"
    >
      <p className="mb-2.5 m-0">
        <strong className="text-white">We use cookies for analytics.</strong>{" "}
        The only third-party cookie on this site comes from Google Analytics,
        which we use to see which pages land. No ads, no cross-site tracking.{" "}
        <a href="/privacy" className="text-[#ff5a1f] underline">
          Read the Privacy Policy
        </a>
        .
      </p>
      <div className="flex gap-2 justify-end flex-wrap">
        <button
          type="button"
          onClick={() => choose("denied")}
          className="font-semibold text-xs tracking-wider uppercase px-3.5 py-2 rounded-sm cursor-pointer bg-transparent text-[#e5e5e5] border border-[#3a3a3a] hover:border-[#e5e5e5]"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={() => choose("granted")}
          className="font-semibold text-xs tracking-wider uppercase px-3.5 py-2 rounded-sm cursor-pointer bg-[#ff5a1f] text-[#0a0a0a] border border-[#ff5a1f] hover:bg-[#ff7a40]"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
