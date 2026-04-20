# Bing Webmaster Tools delta — 2026-04-20 (vs. 2026-04-18 baseline)

**Scheduled checkpoint.** This doc was created by the automated `pg-checkpoint-2026-04-20-gsc-bing` task. Seth was not at the keyboard when it ran, so the numeric fields below are scaffolded for him to paste into. Structure mirrors `marketing/baselines/2026-04-18-bing-baseline.md`.

**Account:** `ai@manugames.com` — **property must be `https://peanutgallery.live/`** before pulling numbers. Bing account has multiple properties; see auto-memory `feedback_seo_account_verification.md`.

**Why today is the ETA:** the 2026-04-18 baseline documented Bing Search Performance as locked behind a 48-hour preparation window ("Please check back in 48 hours while we prepare the data for your site"). 2026-04-20 is that unlock date.

## Status

| Checkpoint step | Status |
|---|---|
| Bing property confirmed as `https://peanutgallery.live/` | ⏳ blocked on Seth |
| Search Performance report unlocked? (was locked on 2026-04-18) | ⏳ blocked on Seth — key question |
| 7-day performance pulled | ⏳ blocked on Seth |
| Sitemap URL count re-checked vs. 2026-04-18 (was 1 — expected 10) | ⏳ blocked on Seth |
| IndexNow enablement decision | ⏳ pending |

## Delta table — headline numbers

Fill these in from Bing Webmaster Tools → **Search Performance**, date range last 7 days:

| Metric | 2026-04-18 baseline | 2026-04-20 value | Δ | Notes |
|---|---|---|---|---|
| Status | "Check back in 48h" | ___ | — | "Report unlocked" is itself a delta event |
| Total clicks (7d) | n/a (locked) | ___ | — | |
| Total impressions (7d) | n/a (locked) | ___ | — | |
| Average CTR | n/a | ___% | — | |
| Average position | n/a | ___ | — | |
| Date range populated | none | ___ | — | |

If Search Performance **is still showing the "48h" message** on 2026-04-20: screenshot it for timestamp and re-check tomorrow. Bing's 48h ETA is a guideline, not an SLA.

## Top 10 queries (if any)

Bing Webmaster Tools → Search Performance → **Queries** tab, sorted by impressions desc, last 7d:

| # | Query | Impressions | Clicks | Position |
|---|---|---|---|---|
| 1 |  |  |  |  |
| 2 |  |  |  |  |
| 3 |  |  |  |  |
| 4 |  |  |  |  |
| 5 |  |  |  |  |
| 6 |  |  |  |  |
| 7 |  |  |  |  |
| 8 |  |  |  |  |
| 9 |  |  |  |  |
| 10 |  |  |  |  |

Bing historically surfaces query data sooner than Google on a new property (smaller query set, less aggressive spam filtering). Don't be surprised if Bing shows impressions while GSC still shows zeros — that happened routinely on past properties.

## Top 10 pages

Bing Webmaster Tools → Search Performance → **Pages** tab, last 7d:

| # | Page | Impressions | Clicks | Position |
|---|---|---|---|---|
| 1 |  |  |  |  |
| 2 |  |  |  |  |
| 3 |  |  |  |  |
| 4 |  |  |  |  |
| 5 |  |  |  |  |
| 6 |  |  |  |  |
| 7 |  |  |  |  |
| 8 |  |  |  |  |
| 9 |  |  |  |  |
| 10 |  |  |  |  |

## Sitemap URL-count reconciliation (carried over from 2026-04-18)

The 2026-04-18 baseline flagged a hard discrepancy:

| Source | URLs discovered (2026-04-18) | URLs discovered (2026-04-20) |
|---|---|---|
| Google Search Console | 10 | ___ |
| Bing Webmaster Tools | **1** | ___ |

Re-check in Bing → Sitemaps. Questions to answer:

1. Is Bing's count still 1? If yes → the sitemap really does only contain 1 URL, or Bing hasn't re-crawled in 5 days. Resubmit the sitemap from the Bing dashboard; one-click forces a fresh crawl.
2. Did Bing's count jump to ~10? If yes → the Apr 15 parse was stale. Problem resolved itself.
3. Does GSC still show 10? If GSC dropped below 10 that's a coverage problem we need to investigate (sitemap generation may have regressed).

**Parallel check (not blocked on Seth):** WebFetch of `https://peanutgallery.live/sitemap.xml` is egress-blocked from this sandbox (commonly blocked for peanutgallery.live per prior checkpoints). If Seth can `curl` it from his local terminal and paste the URL count, we resolve the Bing-vs-GSC question instantly. Lower-priority alternative: read `app/sitemap.ts` and simulate the URL generation locally.

## AI Performance surface (Bing Copilot citation tracking)

The 2026-04-18 Bing baseline called this out as the single most interesting Bing-specific signal we can capture — shows when peanutgallery.live is cited in Copilot / Bing Chat / Bing AI summaries.

| Metric | 2026-04-18 | 2026-04-20 |
|---|---|---|
| Report visible in dashboard | ✅ (public preview) | ___ |
| Citations (7d) | unknown (not captured) | ___ |
| Top citing prompts | n/a | ___ |

Even one citation here is a genuinely interesting data point given the schema.org graph push from Week 1 — LLM-era search consumes structured data heavily. This is our first chance to measure whether that investment has a visible return.

## IndexNow enablement

Open action from 2026-04-18 baseline. No progress from a scheduled-task-only pass — requires Seth to either authorize a key in Bing's IndexNow settings or approve a Next.js build hook addition.

| Decision | Status |
|---|---|
| Generate IndexNow API key | ⏳ pending Seth |
| Add `/<key>.txt` to `public/` | ⏳ pending |
| Wire Next.js post-build hook to ping `api.indexnow.org` | ⏳ pending |

Low-priority until we're actually publishing new URLs at a clip that justifies the latency savings. Flag for Week 2/3.

## Decisions / actions surfaced by this delta

Fill in after pulling numbers.

1. **If Bing shows impressions while GSC doesn't:** that's the norm on new properties — don't over-index on it. But the *queries* themselves are valuable; they preview what GSC will eventually show.
2. **If Bing's sitemap count is still 1:** resubmit (one click in Bing dashboard) and re-check in 48h.
3. **If AI Performance shows any citations:** screenshot and archive. This is the Week 1 schema.org ROI measurement.
4. **If both Search Performance and AI Performance remain unpopulated:** not alarming — Bing's data pipeline is slower than GSC's for new properties. Re-check at the 2026-04-25 checkpoint.

## Next checkpoint

- **2026-04-25** — 7-day post-variant delta; first real impression/click numbers per the 2026-04-18 projection.
- **2026-05-16** — first meaningful position data.

This delta doc gets archived as-is once 2026-04-25 delta is written.
