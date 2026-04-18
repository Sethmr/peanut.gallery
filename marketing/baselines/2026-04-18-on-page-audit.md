# On-page SEO audit — 2026-04-18

Audited directly from the Next.js source (WebFetch to `peanutgallery.live` was egress-blocked; source is authoritative anyway). Scope: `app/layout.tsx`, `app/page.tsx`, `app/install/page.tsx`, `app/watch/page.tsx`, `app/sitemap.ts`, `app/robots.ts`.

## Summary

The marketing surfaces (`/`, `/install`) are in very good shape. Schema.org graph is deep (SoftwareApplication + FAQPage + Organization + Person + 3 × VideoObject, all @id-linked). Metadata is tight and matches the Variant A keyword strategy. The main gaps are (1) a metadata hole on `/watch` that's producing a high-traffic but off-message page, (2) a tiny sitemap (4 URLs — doesn't match GSC's "10 discovered"), and (3) no breadcrumb or HowTo schema on `/install` despite having numbered install steps that would qualify for rich results.

## Page-by-page findings

### `/` (homepage) — GOOD, minor tweaks only

**Title (inherited from `app/layout.tsx`):** "Peanut Gallery — AI writers' room for YouTube (Chrome extension)" — 69 chars, under Google's 60-char hard cutoff but above the 55-char sweet spot for mobile SERPs. Acceptable.

**Meta description:** 247 chars. Google typically truncates at ~155–160. First 160 chars: "Free Chrome extension that adds 4 AI personas to any YouTube video — a fact-checker, comedy writer, sound effects guy, and cynical troll react in real-time…". That's a clean truncation point — the key hook lands before the cut. Fine as is.

**H1:** "An AI writers' room for any YouTube video." — short, benefit-first, keyword-adjacent ("AI", "YouTube"). Passes.

**H2s (in order):**
1. "Two minutes with Peanut Gallery." (demo section)
2. "Smart Director v2 — the full walkthrough." (walkthrough)
3. "One click from the Chrome Web Store." (install)
4. "Prefer to run it yourself? 4 steps." (self-host)
5. "Not a Node shop? Rebuild the backend in your stack." (byo backend)
6. "Two packs. Four slots. One dropdown." (personas)
7. "The show watches itself." (architecture)
8. "Multi-provider by design." (stack)
9. "The web app still exists — as a reference." (reference app)
10. "Built for a bounty. Shipped as a product." (origin)

Strong hierarchy, but **H2 #9 is the problem**: "The web app still exists — as a reference" is the first thing Google sees below the fold about `/watch`. It signals "secondary artifact, not product" — which is *exactly right for readers* but means any `/watch` search impression Google attributes to the homepage gets a confusing preview. Not a blocker; just a note.

**Keyword density spot-check:**
- "YouTube" — ~18 occurrences (healthy)
- "AI" — ~14 occurrences (healthy, not stuffed)
- "Chrome extension" / "extension" — ~10 occurrences (strong signal)
- "side panel" — 5 occurrences (good for the differentiator)
- "open source" — 4 occurrences (trust signal for the blue-ocean story)
- "This Week in Startups" / "TWiST" — 5 occurrences (branded traffic opportunity)

No keyword stuffing; no dilution. ✅

**Internal linking:**
- Anchor links to `#demo`, `#install`, `#personas`, `#how`, `#stack` — fine for on-page navigation, weak for crawlable internal links.
- `Link href="/watch"` in two places (reference app section + footer) — ties `/watch` into the crawl graph.
- No inbound link from `/` to `/install` (the `/install` page). The in-page "Install" section is a `#install` fragment — Google treats fragments as the same URL. **That means `/install` is an orphan from `/` in the internal-link graph.** Not ideal.

**External trust links:** GitHub, CWS, sethrininger.dev, x.com/jason, x.com/lonharris, x.com/twistartups — good outbound profile.

### `/install` — GOOD

**Title:** "Install the Peanut Gallery Chrome Extension" — 45 chars, keyword-rich at the front.

**Meta description:** "Install Peanut Gallery for Chrome — the free, open-source YouTube AI sidebar. Four AI personas react to any YouTube video in real time from Chrome's native side panel." — 167 chars (slight overflow from Google's typical cutoff). Trim to 160 for guaranteed display: _"Install Peanut Gallery for Chrome — the free, open-source YouTube AI sidebar. Four AI personas react live to any YouTube video from Chrome's side panel."_ — 150 chars. **Tiny tweak worth making.**

**H1:** "Install the Peanut Gallery Chrome Extension" — matches title, good.

**H2s:**
1. What is Peanut Gallery?
2. How to install
3. Self-host or build your own backend
4. Features
5. Requirements
6. Privacy

Clean hierarchy. The numbered `<ol>` under "How to install" is **exactly the pattern Google looks for in `HowTo` schema**. We're not emitting `HowTo` JSON-LD for it — missed opportunity. See Action 3 below.

**Canonical:** `https://peanutgallery.live/install` — set correctly.

**OpenGraph:** present on this page, overrides layout defaults. Good.

### `/watch` — 🚩 NEEDS ATTENTION

**Context:** Per the 2026-04-18 GA4 baseline, this page pulled **212 views in the last 7 days** vs. **9 on the homepage**. It's the dominant acquisition surface by view count. Two problems:

1. **No page-specific metadata.** `app/watch/page.tsx` is `"use client"`, so it can't export `metadata`. It falls back to the layout defaults, which advertise the Chrome extension — good — but the page itself is the **legacy web app**. There's no page-local control over canonical, OG image, or description.

2. **No visible "get the extension" CTA.** The top bar has a logo linking to `/` and a GitHub link. That's it. Visitors who land on `/watch` from a stale TWiST link get the reference app with no nudge toward the CWS listing — which is where we actually want the conversion to happen.

**The fix is small and falls within the project rule** "only tiny SEO tweaks on /watch":
- Add `app/watch/layout.tsx` (a new server component layout) that exports page-specific `metadata`. This works cleanly because Next.js lets a nested layout wrap a client page and still export metadata.
- Add a slim **dismissible banner** to the top of the client page: *"This is the reference web app. For the real product, get the Chrome extension →"*. 12 lines of JSX, no new deps.

Proposed diff: see `marketing/baselines/2026-04-18-watch-proposed-diff.md` (next doc in this batch).

### `/privacy`

Didn't audit in depth — it's static marketing copy with no commercial intent. Title pattern from layout (`Privacy Policy | Peanut Gallery`) is correct. Low SEO priority.

## Schema.org graph — excellent

From `app/layout.tsx`:

- `SoftwareApplication` (Peanut Gallery, v1.0.6, MIT, free, 4 `featureList` entries) — ✅
- `FAQPage` with 7 Q&As — ✅ (this should unlock FAQ rich snippets in ~2–4 weeks)
- `Organization` with `@id` anchor + `logo` + `sameAs` to GitHub + CWS — ✅ (added this session)
- `Person` (Seth) with `@id` anchor + `jobTitle` + `knowsAbout` + `sameAs` to GitHub/X/personal site — ✅ (added this session)
- 3 × `VideoObject` (v1.5 walkthrough, product demo, Jason $5k bounty clip) — ✅
- Cross-linked via `publisher` / `author` / `founder` `@id` refs — ✅

**Gaps:**
- No `HowTo` schema on `/install` for the 5-step install flow. This is a straightforward add that unlocks a separate rich-result surface ("step-by-step install" cards in SERPs).
- No `BreadcrumbList` on `/install` or `/watch`. Low-value for a 3-level site, but trivial to add and it's free impression territory on mobile SERPs.
- No `Review` or `AggregateRating` — we don't have reviews yet, so skip.

## Sitemap — 🚩 DISCREPANCY

`app/sitemap.ts` currently emits **4 URLs**:
1. `/`
2. `/install`
3. `/watch`
4. `/privacy`

But GSC reports **10 discovered pages** in the sitemap. And Bing reports **1 URL** discovered.

Possible explanations:
- **GSC:** counting the sitemap URLs *plus* URLs it has discovered via crawl (homepage anchor links counted as sub-paths? unlikely). More plausible: GSC is showing "discovered" as the total across all discovery methods, not just the sitemap submission — the number includes crawl-discovered paths like CWS offsite assets that happen to link back.
- **Bing:** definitely under-counting. Likely parsed the sitemap once on 2026-04-15 and cached the result. Needs a re-submit (action in Bing baseline doc).

Ground truth now: the sitemap has **4 URLs** — matches the source file, end of story. No junk routes leaked in. The "10 discovered" in GSC is a harmless metadata artifact; the "1 URL" in Bing is a stale parse that will self-correct on next crawl.

## `robots.ts` — fine

Allows everything, points to sitemap. No blockers.

## On-page action items

1. **[P1 — tiny diff]** Trim `/install` meta description from 167 → ~150 chars to dodge Google's truncation. Exact replacement string in the proposed-diff doc.
2. **[P1 — tiny diff]** Add `app/watch/layout.tsx` with page-specific metadata. Include: title ("Peanut Gallery — Reference Web App"), description ("The original web-app prototype. For real-time YouTube AI reactions, install the Chrome extension."), canonical `https://peanutgallery.live/watch`, `robots: { index: true, follow: true }` (keep it indexed — 212 views/week is real traffic).
3. **[P1 — tiny diff]** Add a 2-line dismissible banner at the top of `/watch` linking to the CWS listing. Converts the 212 weekly views that currently bounce off.
4. **[P2]** Add `HowTo` JSON-LD to `/install` for the 5-step install flow. ~30 lines of JSON, unlocks a rich-result surface.
5. **[P2]** Add `BreadcrumbList` JSON-LD to `/install`, `/privacy`, `/watch`. Nice-to-have.
6. **[P2]** Add an explicit `<Link href="/install">` on the homepage. Currently `/install` is orphaned from `/` in the internal-link graph; the `#install` fragment doesn't count. Easy fix: change the footer "Reference App" area or the hero secondary CTA to point at `/install`.

## What's out of scope

- `/watch` rebuild (project rule: "no feature/refactor work without explicit approval").
- Any new marketing pages (`/packs/*`, etc.) — in the SEO plan for Week 3+.
- Schema changes that require source data we don't have (e.g., `AggregateRating` needs actual reviews).
