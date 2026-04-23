# SEO snapshot — 2026-04-22

Baseline pulled from GSC, Bing Webmaster Tools, and GA4 in the same browser session. Sibling to the existing `2026-04-18-*-baseline.md` files. Use this as the next prior when re-running the monthly performance prompt (Prompt 19 in [`SEO-PLAN.md`](../SEO-PLAN.md)).

---

## Actions taken

| Surface | Action | Result |
|---|---|---|
| GSC | Re-submitted `https://www.peanutgallery.live/sitemap.xml` | Status: Success. Last submit + last read: **2026-04-22**. URLs discovered: **5** (the 6th — `/terms/` — will appear on next re-fetch once the site deploys with the updated sitemap). |
| GSC → URL Inspection → Request Indexing | `/`, `/pricing/`, `/manual/`, `/panel/`, `/privacy/`, `/terms/` | 5 of 6 queued. **`/terms/` REJECTED**: "During live testing, indexing issues were detected with the URL." Confirmed by `curl` — the page returns **404** on the live site (it's only in the local `site/` folder; not deployed yet). |
| BWT | Re-submitted `https://www.peanutgallery.live/sitemap.xml` | Status: Processing. Last submit: 2026-04-22. URLs discovered: 5. Property already verified. |
| BWT → Sitemaps | **Deleted** stale apex-domain sitemap (`https://peanutgallery.live/sitemap.xml`, 1 URL, last crawled 2026-04-15) | Known sitemaps: 2 → 1. Removes the duplicate signal. |
| BWT → URL Submission | Submitted `/pricing/` and `/terms/` (the two live URLs missing from prior submission batch) | Submitted today at 11:04. Total 7 URLs in BWT submission list; quota: 98 / 100 remaining. |
| Local repo | Generated IndexNow API key + key file | `site/f6034c7304ba548b70ba5a95b9d559f8.txt` — once deployed, IndexNow API can ping Bing/Yandex on every site update. |
| GA4 | Read-only baseline pull. No config changes. | — |

### Live-URL HTTP status (sanity check)

```
200  https://www.peanutgallery.live/
200  https://www.peanutgallery.live/pricing/
200  https://www.peanutgallery.live/manual/
200  https://www.peanutgallery.live/panel/
404  https://www.peanutgallery.live/terms/   ← not deployed
200  https://www.peanutgallery.live/privacy/
```

`/terms/` is the single deploy-gated item on the SEO sweep.

---

## Google Search Console

### Performance — last 28 days

| Metric | Value |
|---:|---:|
| Total clicks | **0** |
| Total impressions | **13** |
| Average CTR | 0% |
| Average position | **20.8** |

**Top queries:**

| Query | Impressions | Clicks | Position |
|---|---:|---:|---:|
| `"deepgram"` | 2 | 0 | — |
| *(only 1 query row in the table)* | | | |

**Top pages (by impressions):**

| URL | Impressions | Clicks |
|---|---:|---:|
| `https://peanutgallery.live/privacy` | 7 | 0 |
| `https://www.peanutgallery.live/` | 6 | 0 |
| `https://www.peanutgallery.live/manual/` | 1 | 0 |

### Page indexing

| Bucket | Count |
|---|---:|
| Indexed pages | **2** |
| Not indexed | **1** (reason: "Crawled - currently not indexed", validation Not Started) |
| Discovered in sitemap | 5 |

So Google knows about 3 pages, has indexed 2, has crawled-but-rejected 1, and hasn't yet processed 2 more from the sitemap.

### Sitemap

- Status: Success
- Last submitted: 2026-04-22 (re-submitted today)
- Last read: 2026-04-22

---

## Bing Webmaster Tools

| Metric | Value |
|---:|---:|
| Total clicks (3 mo) | **0** |
| Total impressions (3 mo) | **0** |
| Avg CTR | 0% |
| Indexed URLs (Site Explorer) | **No data** — Bing has indexed essentially nothing yet |

**Sitemaps:**

| Sitemap | Last submit | Last crawl | Status | URLs discovered |
|---|---|---|---|---:|
| `https://www.peanutgallery.live/sitemap.xml` | 2026-04-22 | 2026-04-19 | Processing | 4 → 5 |
| `https://peanutgallery.live/sitemap.xml` (apex, legacy) | 2026-04-15 | 2026-04-15 | Success | 1 |

The apex-domain sitemap is stale and only ever discovered 1 URL — likely a configuration drift from before the `www.` canonical took over. Worth deleting from BWT to remove the duplicate signal.

---

## GA4 (peanut.gallery.property)

### Topline — last 28 days (Mar 25 – Apr 21)

| Metric | Value |
|---:|---:|
| Active users | 72 |
| New users | 73 |
| Avg engagement / active user | 1m 37s |
| Real-time active users | 0 |

User activity is heavily concentrated in the last 7 days (72 active users in last 7d == nearly all of the 28d total) — looks like a recent traffic spike, possibly tied to the v1.5.x ship.

### Sessions by channel — last 28 days

| Channel | Sessions |
|---|---:|
| Direct | **108** |
| Organic Social | 27 |
| Referral | 13 |
| Organic Search | **3** |
| Unassigned | 1 |
| **Total** | **152** |

Organic search is 3 sessions / 28 days — matches GSC (0 clicks, 13 impressions) and BWT (0 clicks). The 3 GA4 organic sessions probably came from edge providers GSC/BWT don't surface (DuckDuckGo, Brave, Ecosia, etc.).

### Top countries (28d)

| Country | Active users |
|---|---:|
| United States | 44 |
| Canada | 5 |
| India | 5 |
| Poland | 4 |
| Estonia | 2 |
| United Kingdom | 1 |
| Georgia | 1 |

US is 61% of active users — matches the Plus US-only gating rationale.

### Top page views (28d)

| Page title | Views |
|---|---:|
| `Peanut Gallery — AI Podcast Sidebar` | **212** |
| `Peanut Gallery — AI writers' room fo…` | 101 |
| 404: This page could not be found | 6 |
| Privacy Policy \| Peanut Gallery | 6 |
| Operator's Manual · Peanut Gallery | 5 |
| Side Panel Proof Sheet · Peanut Gallery | 5 |
| Privacy Policy · Peanut Gallery | 3 |

**The top page title (212 views) is the OLD pre-rebrand wording** ("AI Podcast Sidebar"). The current homepage `<title>` is "Peanut Gallery — AI writers' room for YouTube (Chrome extension)" — the 101-view entry. The 212/101 split is the old vs. new title showing up as two distinct rows in GA4's title-based view, since the title changed during the last 28 days.

There are **two distinct privacy-policy titles** also showing as separate rows (6 + 3 = 9 total). Likely one is the SSG `/privacy` (6 views) and the other is the Next.js `/privacy/` route (3 views) — worth canonicalising.

### Top events (28d)

| Event | Count |
|---|---:|
| `page_view` | 343 |
| `user_engagement` | 197 |
| `scroll` | 171 |
| `session_start` | 152 |
| `first_visit` | 73 |
| `click` | 21 |
| `github_click` | **6** |

### Key events (28d)

| Key event | Count |
|---|---:|
| `github_click` | 6 |
| `try_web_app` | 2 |
| **Total** | **8** |

That's a 343→21→6 funnel from page-view to outbound GitHub click — ~1.7% of page views become GitHub clicks. **There is no `cws_install_click` or equivalent event tracking the Chrome Web Store CTA**, which is the actual primary conversion. Without it, every CWS click is invisible to GA4.

---

## Findings (what stands out)

1. **Organic search is the floor — 3 sessions / 28d.** GSC shows 13 impressions but 0 clicks at avg position 20.8, so the site is being seen on page 2/3 SERPs and not getting picked. The keyword footprint is essentially `deepgram` only — the brand name and the product keywords aren't ranking yet.
2. **Indexing is the bottleneck before SEO content can move the needle.** 2 indexed / 1 crawled-not-indexed / 2+ discovered-not-yet-crawled means Google has only had eyes on a fraction of the site. Until index coverage > 80%, any content added is invisible.
3. **Bing index is empty.** 0 indexed URLs, sitemap submitted but unprocessed for indexing. Need IndexNow integration (BWT → IndexNow) to push fresh content directly. Quick win.
4. **GA4 is missing the install-funnel event.** The CWS install button is not instrumented. `github_click` exists; `cws_install_click` should too. Without it the headline "did organic traffic convert to an install?" question can't be answered.
5. **Two distinct page-title fingerprints for `/`** (212 + 101 views) confirm the title changed mid-window. Title changes don't break GA4 but they fragment historical analysis — note in the next monthly report.
6. **Two privacy-policy titles** suggest a duplicate page or canonical issue. Worth checking which template is winning.
7. **Direct dominates traffic (71%).** Plausible mix is X/Slack/Discord/LinkedIn drops by Seth + the inbound from the v1.5.x blog post / TWiST bounty announcements. Not a problem; it's the expected shape for a builder-led launch. SEO is supposed to take this from "100% Seth-driven" to "50% organic" over the next 90 days.
8. **`/terms/` is not in Google's or Bing's discovered set.** The sitemap with `/terms/` only exists locally — the site needs to deploy before either crawler will pick it up.

---

## Next steps (ordered by impact × effort)

### Immediate (this week)
1. **Deploy the updated `site/`** — biggest unblocker. Ships: index.html meta refresh, new OG image, `/terms/` page (currently 404), `/terms/` in sitemap, and the IndexNow key file `f6034c7304ba548b70ba5a95b9d559f8.txt`. Until they ship, the rest of this list is theoretical.
2. **After deploy: re-submit sitemap once more in BOTH GSC and BWT.** Both have today's submission cached but the URL counts will jump from 5 → 6 once `/terms/` is reachable.
3. **After deploy: re-run GSC URL-inspect → Request Indexing on `/terms/`.** It was rejected today (404). Once it's live, push it back to the priority crawl queue.
4. **After deploy: hit the IndexNow API once** to verify the key file (`https://www.peanutgallery.live/f6034c7304ba548b70ba5a95b9d559f8.txt` should return `f6034c...8`). Then ping all 6 URLs at once via:
   ```bash
   curl -X POST 'https://api.indexnow.org/indexnow' \
     -H 'Content-Type: application/json' \
     -d '{
       "host":"www.peanutgallery.live",
       "key":"f6034c7304ba548b70ba5a95b9d559f8",
       "keyLocation":"https://www.peanutgallery.live/f6034c7304ba548b70ba5a95b9d559f8.txt",
       "urlList":[
         "https://www.peanutgallery.live/",
         "https://www.peanutgallery.live/pricing/",
         "https://www.peanutgallery.live/manual/",
         "https://www.peanutgallery.live/panel/",
         "https://www.peanutgallery.live/privacy/",
         "https://www.peanutgallery.live/terms/"
       ]
     }'
   ```
5. **Add a `cws_install_click` GA4 event** to the install button on the landing page. Mirror the existing `github_click` pattern. Mark as a Key Event so it shows up in the conversion table — this is the actual primary conversion, currently invisible to GA4.

### 30 days
6. **Run [Prompt 5 — GitHub repo SEO audit](../SEO-PLAN.md)** to capture topics + README hero + repo description. The repo is the second-most-likely organic discovery surface after the site itself.
7. **Investigate the duplicate privacy-policy titles** in GA4 — check whether one is `/privacy` vs `/privacy/` (trailing slash split). Add a 301 if so.
8. **Refresh the OG image cache on social platforms** post-deploy: [X Card Validator](https://cards-dev.twitter.com/validator), [Meta Sharing Debugger](https://developers.facebook.com/tools/debug/), [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/).

### Pre-2.0 content gaps (recommended additions)
9. **Pack landing pages for Howard + TWiST** — `/packs/howard` + `/packs/twist`. [SEO-PLAN.md § Prompt 10](../SEO-PLAN.md) calls these "the single highest-leverage content play PG has." Each fan search for `[show name] AI`, `watch [show name] with AI`, `[show name] fact checker` is a qualified install with near-zero competitive noise. Both packs already ship with illustrated peanut mascots, so the content is real (not aspirational). ~half day of work for both.
10. **A `/plus` landing page** — a real Plus subscription page (separate from the pricing page). Today the FAQ schema describes Plus, the pricing page mentions Plus, but no dedicated `/plus` URL exists for fans of competitor `/pricing` pages or for Stripe `success_url` cleanup. Stripe's success URL (`/plus/welcome`) and cancel URL (`/plus/cancelled`) per the checkout route are both 404 today. Three pages: `/plus`, `/plus/welcome`, `/plus/cancelled`. ~2 hours.
11. **`/install` landing page** — currently absent (per [SEO-PLAN.md § Already in place](../SEO-PLAN.md), `/install` was assumed but actually was never built on this static site iteration; the `installUrl` JSON-LD points directly at the CWS URL). A dedicated `/install` page that walks Chrome users through the install (with screenshots, "what to expect" copy, and an FAQ) would absorb the GSC search-term pattern `install [extension name]` and be the natural target for the "Install" CTA from `/`. ~half day.

### 90 days
12. **Re-run the [Prompt 1 — CWS category audit](../SEO-PLAN.md)** and [Prompt 9 — Money page audit](../SEO-PLAN.md) once GSC has 90 days of richer data.
13. **Update [`SEO-PLAN.md`](../SEO-PLAN.md) §1**: it still describes the product as "Free. BYOK." with no Plus tier; the Claude Design tokens cite the dark-theme palette; "current packs: Howard and TWiST" is correct but Plus needs to be added to "Pricing / monetization."

### 90 days
10. **Re-run the [Prompt 1 — CWS category audit](../SEO-PLAN.md)** and [Prompt 9 — Money page audit](../SEO-PLAN.md) once GSC has 90 days of richer data.
11. **Update [`SEO-PLAN.md`](../SEO-PLAN.md) §1**: it still describes the product as "Free. BYOK." with no Plus tier; the Claude Design tokens cite the dark-theme palette; "current packs: Howard and TWiST" is correct but Plus needs to be added to "Pricing / monetization."

---

## Source-of-truth pointers

- Updated meta tags: [`site/index.html`](../../../site/index.html) (lines 9–32 head + JSON-LD lines 1453+)
- Updated OG image: [`site/assets/og-image.png`](../../../site/assets/og-image.png) (1200×630, source SVG: `og-image.svg`)
- Updated sitemap: [`site/sitemap.xml`](../../../site/sitemap.xml) (now includes `/terms/`)
- Canonical SEO playbook: [`marketing/SEO-PLAN.md`](../SEO-PLAN.md)
- Prior baselines: [`marketing/baselines/2026-04-18-ga4-baseline.md`](2026-04-18-ga4-baseline.md), [`marketing/baselines/2026-04-18-gsc-baseline.md`](2026-04-18-gsc-baseline.md), [`marketing/baselines/2026-04-18-bing-baseline.md`](2026-04-18-bing-baseline.md)
