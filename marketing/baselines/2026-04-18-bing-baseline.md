# Bing Webmaster Tools baseline — 2026-04-18

Captured live from Bing Webmaster Tools via Chrome MCP. Account: `ai@manugames.com`. Property: `https://peanutgallery.live/`.

## Headline numbers

| Metric | Value |
|---|---|
| Search Performance | **"Please check back in 48 hours while we prepare the data for your site"** |
| Property verification | ✅ Verified |
| Indexed / discovered | Via sitemap: 1 URL |

Bing hasn't aggregated performance data yet — same pattern as GSC. Site was verified recently; data populates on a ~48h delay.

## Sitemap status

| Metric | Value |
|---|---|
| Known sitemaps | 1 (`https://peanutgallery.live/sitemap.xml`) |
| Sitemaps with errors | 0 |
| Sitemaps with warnings | 0 |
| **Total URLs discovered** | **1** |
| Last submit | 2026-04-15 |
| Last crawl | 2026-04-15 |
| Status | Success |

## 🚩 Discrepancy with GSC

| Source | URLs discovered |
|---|---|
| Google Search Console | 10 |
| Bing Webmaster Tools | **1** |

Bing is only seeing 1 URL in the sitemap. That's either:

1. **Bing parsed the sitemap the day it was submitted (Apr 15) and hasn't re-crawled since** — the site may have grown to 10 URLs afterward and Google saw the new version on Apr 16 while Bing kept the stale count.
2. **The sitemap really does have 1 URL and GSC is counting something else** (discovered via internal crawl, not just sitemap).

**Action:** audit `app/sitemap.ts` output directly via WebFetch of `https://peanutgallery.live/sitemap.xml` to see ground truth. If >1 URL, resubmit the sitemap in Bing to force a re-crawl.

## Next-measurement checkpoints

- **2026-04-20** (2 days): Search Performance data should populate.
- **2026-04-25** (1 week): first impression/click numbers.
- **2026-05-16** (4 weeks): first meaningful position data.

## Action items surfaced by this baseline

1. **Audit the live sitemap.xml** to confirm URL count (should be ~10, not 1).
2. **Resubmit the sitemap in Bing** after confirming it's correct — one click, forces a fresh crawl.
3. **Enable IndexNow in Bing** — Bing has a free push-based indexing API that gets new URLs indexed in ~minutes instead of days. `app/sitemap.ts` + a small Next.js build hook can push updates automatically.
4. **Explore Bing's "Keyword Research" tool** — it's free (unlike Ahrefs/SEMrush), uses Bing's organic data, and gives us a second opinion on keyword volume. Good enough for week-to-week decisioning on content topics.
5. **Consider Bing's new "AI Performance" report** (public preview per the home page) — shows when the site is cited in Copilot/Bing AI summaries. Potentially our single best indicator of whether the site ranks in the LLM-answer era.
