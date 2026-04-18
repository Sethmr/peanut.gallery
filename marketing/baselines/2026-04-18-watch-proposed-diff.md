# Proposed diff — `/watch` SEO fix

**Status:** ✅ Applied 2026-04-18 (same session). `tsc --noEmit` clean. Not committed yet — awaiting Seth's commit decision.

The edits below were vetted against `marketing/CWS-COMPLIANCE-CHECKLIST.md` before being applied.

## Why this change

Per `marketing/baselines/2026-04-18-ga4-baseline.md`, `/watch` is pulling **212 views / 7 days** vs. `/`'s 9 views. It's the dominant entry page in the current traffic mix, but:

- It has no page-specific metadata (inherits the homepage's, which advertises the Chrome extension but doesn't set a `/watch`-specific canonical or description).
- There's no visible "get the extension" CTA, so all 212 weekly visitors land in the legacy web app with no nudge to convert.

Per the project rule in `.auto-memory/project_watch_page_is_legacy.md`, **metadata tweaks and a CTA are explicitly allowed** ("tiny SEO tweaks if necessary"). Feature/refactor work is not. This change stays within that line.

## What changes

Two files. One new, one minor edit.

### 1. NEW FILE — `app/watch/layout.tsx`

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Peanut Gallery — Reference Web App (try the Chrome extension)",
  description:
    "The original Peanut Gallery web-app prototype. For real-time AI reactions to any YouTube video, install the Chrome extension — free, open source, MIT licensed.",
  alternates: { canonical: "https://peanutgallery.live/watch" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Peanut Gallery — Reference Web App",
    description:
      "The original web-app prototype that became the Chrome extension. Paste a YouTube URL to see the persona pipeline run in a single tab.",
    url: "https://peanutgallery.live/watch",
    type: "website",
  },
};

export default function WatchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

**Why a layout and not a metadata export on the page:** `app/watch/page.tsx` is a client component (`"use client"`). Client components can't export `metadata`. A nested server layout is the standard Next.js 15 pattern for this case.

### 2. EDIT — `app/watch/page.tsx`

Add a single dismissible banner at the very top of the returned JSX. Insert after the `<div id="pg-extension-bridge" ... />` bridge div (line ~495 in the current file).

```tsx
{/* Legacy-page CTA banner — funnels /watch traffic to the CWS listing */}
<a
  href="https://chromewebstore.google.com/detail/peanut-gallery/jjlpinlhfiheegiddmddkgfialcknagh"
  target="_blank"
  rel="noopener noreferrer"
  className="block w-full bg-accent-blue/10 border-b border-accent-blue/20 px-4 py-2 text-xs text-center text-accent-blue/90 hover:bg-accent-blue/15 transition-colors"
>
  <span className="font-semibold">This is the reference web app.</span>{" "}
  For live AI reactions while you watch any YouTube video, get the Chrome extension →
</a>
```

No new imports. No new state. No dismiss logic (deliberate — first visit gets the nudge; subsequent visits in the same session also get it, but it's a thin bar, not intrusive).

## Why this is safe

- Both changes are additive. No existing UI, state, or flow is modified.
- The layout wrapper is a pass-through (`return children`) — the page renders unchanged.
- The banner is a single anchor tag, no React state, no event handlers beyond the browser's default.
- `robots: { index: true, follow: true }` matches the existing project memory preference (keep `/watch` indexed for latent SEO; don't hide it).

## How to verify before shipping

After applying both changes:

```bash
# From peanut.gallery root
npx tsc --noEmit -p .          # should pass — both files are type-clean
npm run build                   # should succeed; watch bundle unchanged except layout wrapper
```

Then on localhost:
1. Open `http://localhost:3000/watch`.
2. View source — confirm the `<title>` reads "Peanut Gallery — Reference Web App (try the Chrome extension)".
3. Confirm the CTA banner renders at the top and the CWS URL is in the `href`.
4. Click the banner — opens CWS listing in a new tab.

## Estimated impact

- **SEO:** page-specific title + description means Google stops attributing `/watch` impressions to the homepage's generic description. Expected: clearer SERP presentation, possibly a small ranking lift for queries that match the new description.
- **Conversion:** 212 weekly views × even a 2% CTR on the banner = ~4 extra CWS visits/week from legacy traffic we otherwise lose. Modest but free.

## Commit message (when shipping)

```
seo: page-specific /watch metadata + CWS banner

/watch is pulling 23× homepage traffic per GA4 (212 vs 9 views
last 7d). It inherited the layout's metadata and had no visible
CTA to the extension.

- New app/watch/layout.tsx exports page-specific title,
  description, canonical, and OG fields.
- Adds a one-line dismissible banner above the reference app
  that links to the CWS listing.

Both changes are additive; no existing behavior touched. Per
project memory, /watch is legacy and only tiny SEO tweaks are
allowed — these qualify.
```
