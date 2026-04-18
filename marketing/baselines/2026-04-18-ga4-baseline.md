# GA4 baseline — 2026-04-18

Captured live from Google Analytics via Chrome MCP. Account: `ai@manugames.com`. Property ID: `533213326` — confirmed as Peanut Gallery based on page titles surfaced in the report. Date range: **Apr 11 – Apr 17, 2026 (last 7 days)**.

## Headline numbers

| Metric | Value |
|---|---|
| Active users (7d) | **36** |
| New users | 36 |
| Event count | 622 |
| Key events | 3 |
| Active users in last 30 min | 1 (US) |

## Traffic by country

| Country | Active users |
|---|---|
| United States | 24 |
| Canada | 3 |
| Poland | 3 |
| Estonia | 1 |
| United Kingdom | 1 |
| India | 1 |
| South Korea | 1 |

US dominates (67%) — expected for a TWiST-audience product. International reach is non-trivial for a site that's been live <1 week.

## Sessions by channel

| Channel | Sessions |
|---|---|
| Direct | 50 |
| Organic Social | 21 |
| Organic Search | **1** |

**Finding:** 98.6% of traffic is direct + social. Organic Search is essentially zero — consistent with GSC showing 0 clicks. The entire SEO opportunity is net-new; there's no existing organic traffic to cannibalize.

## 🚩 Top finding: `/watch` is crushing `/`

**Views by page title (7d):**

| Page title | Views |
|---|---|
| Peanut Gallery — AI Podcast Sidebar | **212** |
| Peanut Gallery — AI writers' room for YouTube (Chrome extension) | 9 |
| 404: This page could not be found. | 4 |
| Privacy Policy \| Peanut Gallery | 3 |

The `/watch` page (old title: "AI Podcast Sidebar") is pulling **23× more views than the new homepage** (`/`). That's massive. Possible causes:

1. Old social links (Twitter/TWiST mentions) pointing at `/watch`, not `/`.
2. `/watch` was the live demo during the bounty announcement and those links are still circulating.
3. Direct URL typed-in traffic from people who only know the old URL.
4. Internal linking: from `/` to `/watch` is driving second-page views on every session.

Per project memory, `/watch` is legacy and we're not rebuilding it. But **212 views/week is a non-trivial acquisition channel** that deserves two small SEO tweaks (allowed under the "tiny SEO tweaks" rule):

- **Add a prominent "Get the Chrome extension" CTA** above the fold on `/watch`.
- **Update the `/watch` `<title>` and meta description** to funnel intent toward the extension: "Peanut Gallery — try the web demo, then get the Chrome extension for live YouTube reactions."

These are ~20-line changes to `app/watch/page.tsx` metadata + one CTA component. Zero risk of breaking the reference app. **I'll draft the change and show you the diff before touching anything.**

## Event breakdown

| Event name | Count |
|---|---|
| page_view | 232 |
| scroll | 134 |
| user_engagement | 129 |
| session_start | 72 |
| first_visit | 36 |
| **click** | **14** |
| form_start | 2 |

**click = 14** across 7 days. Need to drill into GA Events to learn what 14 clicks resolve to — but given we only have 50 direct sessions, that's a ~28% click-through rate on *something*. Probably the install CTA. Worth verifying next session.

## Action items surfaced by this baseline

1. **[PRIORITY 1] Fix the /watch funnel.** Propose minimal metadata + CTA change to `app/watch/page.tsx`. Diff-preview first, ship after Seth approval.
2. **[PRIORITY 2] Identify which 14 clicks are converting.** Drill into GA Events → `click` → breakdown by `link_url`. Feeds next session.
3. **[PRIORITY 3] Track install CTR as a Key Event.** Only 3 "key events" counted across 7 days. GA4 requires explicit Key Event configuration; we should mark the install button click as a Key Event so the 14 clicks start counting toward a conversion funnel.
4. **[PRIORITY 4] Find the Twitter/TWiST links pointing to /watch.** Google `site:twitter.com peanutgallery.live/watch` and `site:thisweekinstartups.com peanutgallery.live` to trace the 21 organic-social sessions. If any high-profile link exists, see if we can get it updated to point at `/` instead — preserves SEO equity on the canonical URL.

## Next-measurement checkpoints

- **2026-04-25** (7d): measure same cohort after Variant A short description ships. Expected delta: small but measurable bump in Organic Search sessions.
- **2026-05-02** (14d): first real install-CTR trend.
- **2026-05-16** (4 weeks): first 4-week rolling view. Will clearly show whether the /watch fix moved the needle.
