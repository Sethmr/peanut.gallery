# Google Search Console baseline — 2026-04-18

Captured live from GSC via Chrome MCP. Account: `ai@manugames.com`. Property: `sc-domain:peanutgallery.live` (domain-level verification — covers http/https/www/non-www).

## Headline numbers

| Metric | Value |
|---|---|
| Total clicks (28d) | **0** |
| Total impressions (28d) | **0** |
| Average CTR | 0% |
| Average position | 0 |
| Date range with data | Apr 14 – Apr 16, 2026 (3 days only) |

## What that means

We are at **true zero** on Google organic search. The property has only 3 days of data — it was verified very recently and hasn't accumulated any queries yet. Every click we gain over the next 12 weeks is pure signal, not noise over an existing baseline.

## Sitemap status

| Sitemap | Status | Submitted | Last read | Discovered pages |
|---|---|---|---|---|
| `https://peanutgallery.live/sitemap.xml` | **Success** | Apr 15, 2026 | Apr 16, 2026 | 10 |

10 discovered pages is consistent with what `app/sitemap.ts` should be generating — homepage, /install, /privacy, /watch, plus any dynamic routes. Worth a follow-up to confirm all 10 are the intended ones and no junk routes leaked in.

## Page indexing

| State | Value |
|---|---|
| Indexed pages | Processing (data not yet available) |
| Not indexed pages | Processing |
| Indexing issues | None flagged yet |

Indexing data will be available within ~24 hours. Re-check on 2026-04-19 / 20 for the first real indexing numbers.

## Core Web Vitals

| Device | Good | Needs improvement | Poor |
|---|---|---|---|
| Mobile | No data | No data | No data |
| Desktop | No data | No data | No data |

No CWV data because there's been no real user traffic. CWV comes from the Chrome UX Report (CrUX), which requires a threshold of real-world visits. Irrelevant until we have traffic; re-measure at Week 4.

## Enhancements

No enhancement surfaces detected yet (no Rich Results, no Breadcrumbs, no FAQ rich snippets, no Video results). This is a priority — we already ship FAQPage + VideoObject + SoftwareApplication schema in `app/layout.tsx`; once Google indexes the pages and validates the schema, these should light up.

## Next-measurement checkpoints

- **2026-04-25** (1 week): first query-level data should appear. Expect 1–50 impressions, probably 0 clicks.
- **2026-05-02** (2 weeks): first meaningful position data. Variant A (keyword-max) should be live by then.
- **2026-05-16** (4 weeks): CWV data starts to populate if we've pushed any real traffic.
- **2026-07-11** (12 weeks): end-of-plan measurement. Target: 100+ clicks from non-branded queries.

## Action items surfaced by this baseline

1. **Verify the 10 sitemap URLs are intentional.** Look at `app/sitemap.ts` — make sure nothing unintended is in the list.
2. **Request indexing for key pages.** Submit `/`, `/install`, `/privacy` via GSC URL Inspection → Request Indexing. Accelerates first-crawl.
3. **Add a `/watch` decision**. Per project memory, `/watch` is a legacy surface. If it's in the sitemap (likely), decide whether to keep it indexed or add `noindex`. Recommendation: keep in sitemap so any latent SEO juice continues, but audit its meta to ensure it isn't confusing Google about what the product is.
4. **Once schema is validated (~24–48h post-crawl), check Enhancements tab** for FAQ / Video / SoftwareApplication rich results.
