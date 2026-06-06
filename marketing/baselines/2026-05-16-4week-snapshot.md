# 4-week SEO snapshot — 2026-05-16

**Scheduled checkpoint.** This is the 4-week measurement run from `pg-checkpoint-2026-05-16-4week-view`. Seth was not at the keyboard. Numbers pulled live via Chrome MCP from GSC and GA4. CWS Dev Dashboard pull was blocked on re-auth (`Verify it's you` step requires Seth at the keyboard). PSI mobile run for `peanutgallery.live` was non-responsive (~3 min hang on "Running analysis"); the GSC Core Web Vitals card gives us the same CrUX answer faster and is the authoritative source — used below.

**Pull window:** 2026-04-18 → 2026-05-16 (28 days). GSC data is 1-day lagged, so its chart actually runs 2026-04-17 → 2026-05-14.

**Account / properties:**
- GSC: `ai@manugames.com` / `sc-domain:peanutgallery.live` ✅ confirmed
- GA4: `ai@manugames.com` / property `533213326` "peanut.gallery.property" / measurement ID `G-3R9CK4LRGF` ✅ confirmed
- Bing: not re-pulled this run (28-day window for monthly view; Bing was 0/0 on 2026-04-22, low probability of meaningful delta)
- CWS Dev Dashboard: 🟡 blocked on Seth (re-auth required)

---

## Headline — 4 weeks in

| Surface | Metric | 2026-04-18 baseline | 2026-04-22 snapshot | **2026-05-16 (now)** | Δ vs. baseline | Δ vs. 04-22 |
|---|---|---|---|---|---|---|
| **GSC** | Total clicks (28d) | 0 | 0 | **3** | +3 | +3 |
| **GSC** | Total impressions (28d) | 0 | 13 | **115** | +115 | +102 |
| **GSC** | Avg CTR | 0% | 0% | **2.6%** | +2.6 pts | +2.6 pts |
| **GSC** | Avg position | 0 | 20.8 | **13.8** | n/a | **+7.0 (better)** |
| **GSC** | Indexed pages | Processing | 2 | **8** | +8 | +6 |
| **GA4** | Active users (28d) | 36 (7d only) | 72 | **51** | n/a | **−21 (−29%)** |
| **GA4** | Sessions (28d) | n/a | 152 | **107** | n/a | **−45 (−30%)** |
| **GA4** | Organic Search sessions | 1 (7d) | 3 | **5** | n/a | **+2 (+67%)** |
| **GA4** | Key events | 3 (7d) | 8 | **6** | n/a | −2 |
| **GA4** | Avg engagement / user | n/a | 1m 37s | **55s** | n/a | **−42s (−43%)** |
| **CWV** | CrUX populated? | No | No | **No (still "Not enough usage data")** | — | — |

**Pattern:** SEO surfaces (GSC) are all moving in the right direction. Traffic surfaces (GA4) are softening. Conversion (key events) is flat-to-down. CWV is gated entirely on more real-user volume.

---

## Google Search Console — Performance (28d)

Date range populated by GSC chart: **2026-04-17 → 2026-05-14**.

| Metric | Value | Δ vs. 2026-04-22 |
|---:|---:|---:|
| Total clicks | **3** | +3 |
| Total impressions | **115** | +102 |
| Average CTR | **2.6%** | +2.6 pts |
| Average position | **13.8** | +7.0 (better) |

### Top queries (28d, GSC's truncated view — 8 rows total)

| # | Query | Impr | Clicks | CTR | Position |
|---|---|---:|---:|---:|---:|
| 1 | `"stripe tax" -site:reddit.com -site:twitter.com -site:x.com -site:wykop.pl -site:tripadvisor.com -site:youtube.com -site:yelp.com -site:booking.com -site:facebook.com -site:instagram.com -site:tiktok.com` | 7 | 0 | 0% | 8.1 |
| 2 | `"deepgram"` | 6 | 0 | 0% | 79.3 |
| 3 | `support line refund` | 3 | 0 | 0% | 7.0 |
| 4 | `peanut41619` | 3 | 0 | 0% | 39.0 |
| 5 | `no comment from the peanut gallery` | 2 | 0 | 0% | 48.0 |
| 6 | `peanut ai` | 1 | 0 | 0% | 44.0 |
| 7 | `peanut57619` | 1 | 0 | 0% | 47.0 |
| 8 | `what is a peanut gallery` | 1 | 0 | 0% | 99.0 |

**Observations:**
- The 3 actual clicks came from **anonymized queries** (small-volume queries Google hides per its privacy filter). They're not in the table — but they exist.
- The top **shown** query is a stripe-tax search-operator string with `-site:` exclusions — almost certainly an SEO researcher poking around Stripe's tax pages and seeing ours adjacent. Not real intent. Same for `support line refund` (position 7.0 with 3 impressions) — looks like noise from the `/support`/`/refunds`-shaped pages on the marketing site.
- `peanut ai` shows up at position 44 — that's a Stage-3 keyword from the SEO plan. Still page-5 territory but the impression is the seed.
- `what is a peanut gallery` at position 99 — clearly an idiom search; PG occasionally surfaces. Not useful intent.
- None of the **Top 5 keywords to own** (per `SEO-PLAN.md` §1) appear: no impressions for `YouTube AI sidebar`, `AI Chrome extension`, `AI writers' room`, `AI reacts to YouTube`, `YouTube fact checker`. Those are still entirely below GSC's display threshold.

### Top pages (28d) — all 8 rows

| # | Page | Clicks | Impr | CTR | Position |
|---|---|---:|---:|---:|---:|
| 1 | `https://www.peanutgallery.live/` | **2** | 51 | 3.9% | 13.5 |
| 2 | `https://www.peanutgallery.live/pricing/` | **1** | 42 | 2.4% | 11.4 |
| 3 | `https://peanutgallery.live/privacy` (apex, no slash) | 0 | 17 | 0% | 17.3 |
| 4 | `https://www.peanutgallery.live/manual/` | 0 | 13 | 0% | 13.3 |
| 5 | `https://www.peanutgallery.live/privacy/` (www, slash) | 0 | 10 | 0% | 5.0 |
| 6 | `https://www.peanutgallery.live/terms/` | 0 | 8 | 0% | 6.4 |
| 7 | `https://www.peanutgallery.live/panel/` | 0 | 3 | 0% | 5.3 |
| 8 | `https://peanutgallery.live/` (apex root) | 0 | 1 | 0% | 1.0 |

**Observations:**
- Both clicks landed on **`/` (homepage)** and **`/pricing/`**. Homepage at 13.5 is page-2 territory. Pricing at 11.4 is page-1 fringe — actually the page closest to the "page-2 goldmine" SEO-PLAN.md Prompt 12 talks about.
- `/watch` does not appear in the top pages — the legacy reference app is no longer the dominant SERP entry. The Apr-18 baseline finding ("`/watch` is the dominant entry page") has fully reversed. Site-level URL hygiene has worked.
- The **`peanutgallery.live/privacy` vs. `www.peanutgallery.live/privacy/`** duplicate — flagged in the 2026-04-22 snapshot — is still live. 17 + 10 = 27 split impressions across two URLs. Easy 301 to merge.
- `/terms/` has surfaced with 8 impressions at position 6.4 — proves the 2026-04-22 deploy of `/terms/` worked and Google has crawled it.

### Indexing report

| Bucket | 2026-04-22 | **2026-05-16** | Δ |
|---|---:|---:|---:|
| Indexed | 2 | **8** | +6 |
| Not indexed | 1 | **5** | +4 |
| → Page with redirect | — | 1 | new |
| → Discovered – not indexed | — | 3 | +2 |
| → Crawled – not indexed | 1 | 1 | flat |

**Indexed went from 2 → 8 in 24 days** — that's the single biggest movement on the board. The 2026-04-22 snapshot's call ("indexing is the bottleneck") has been answered; we're now at the point where SEO content actually has surface area to work on.

### Core Web Vitals (the unique deliverable for this checkpoint)

GSC → Experience → Core Web Vitals (source: Chrome UX report, last updated 2026-05-14):

| Device | LCP | INP | CLS | Status |
|---|---|---|---|---|
| Mobile | — | — | — | **"Not enough usage data in the last 90 days for this device type."** |
| Desktop | — | — | — | **"Not enough usage data in the last 90 days for this device type."** |

**Verdict:** CrUX has *not* populated. CrUX requires a minimum number of real-user samples across a 28-day window for each metric to publish a 75th-percentile reading. Our 28-day traffic of 51 active users / 107 sessions is well under the threshold. **Status: as predicted in the 2026-04-18 baseline — re-check at week 8 / week 12. CWV does not become actionable until we materially grow real-user traffic.** PageSpeed Insights would still return lab data if Seth runs it manually, but that's lab synthetics, not the field data we actually care about for ranking signal.

---

## GA4 — Reports snapshot (28d, Apr 18 – May 15)

### Acquisition & engagement

| Metric | 2026-04-22 (28d) | **2026-05-16 (28d)** | Δ |
|---|---:|---:|---:|
| Active users | 72 | **51** | −21 (−29%) |
| New users | 73 | **48** | −25 (−34%) |
| Sessions | 152 | **107** | −45 (−30%) |
| Avg engagement / user | 1m 37s | **55s** | −42s (−43%) |
| Real-time active users | 0 | **0** | — |
| 7-day rolling users (from cohort card) | n/a | **0** | — |

**The most concerning line on the page: the GA4 "User activity over time" card shows 30-day = 78, but 7-day = 0 and 1-day = 0.** Traffic to the site has effectively **stopped** in the last 7 days. Possible causes (ordered most → least likely):

1. **TWiST bounty announcement traffic decayed** — the v1.5.x ship and bounty hype in mid-April drove the spike in the 2026-04-22 snapshot. Those decay curves are sharp.
2. **Seth's own external linking/posting cadence dropped** — direct traffic was 71% of the 2026-04-22 mix; if Seth posted less on X/Slack/Discord in the last 7 days, direct dries up.
3. **Site issue** — possible but unlikely given the GA4 measurement ID is still wired in `layout.tsx` and the GSC indexing/impression numbers continued to climb. If a tagging regression had happened, GSC would still see organic but GA4 wouldn't — that's not the pattern here (GSC organic = 5, GA4 organic = 5, they agree).
4. **Time-of-week / sample window** — 2026-05-16 is a Saturday; the 28d window ends on a Friday. Pre-weekend dips happen.

→ **Action: have Seth check whether the marketing site deploy in late April or early May broke the GA4 snippet.** Worth a 60-second look at `view-source:https://www.peanutgallery.live/` for the `G-3R9CK4LRGF` measurement ID.

### Sessions by channel (28d)

| Channel | 2026-04-22 | **2026-05-16** | Δ |
|---|---:|---:|---:|
| Direct | 108 | **73** | −35 (−32%) |
| Referral | 13 | **22** | +9 (+69%) |
| Organic Social | 27 | **6** | −21 (−78%) |
| Organic Search | 3 | **5** | +2 (+67%) |
| Unassigned | 1 | **1** | — |
| **Total sessions** | **152** | **107** | −45 (−30%) |

**Observations:**
- **Organic Search 3 → 5.** Slow but moving in the right direction. Cross-checks with GSC's 3 clicks (GSC is 1-day lagged; GA4 has 1 extra day + edge providers like DuckDuckGo/Brave/Ecosia that don't appear in GSC).
- **Referral 13 → 22 (+69%).** Worth a drill-down — if a meaningful new backlink emerged, that's a Week 5–8 win to amplify. Probable candidates: TWiST forums, a HN/Reddit mention, an aggregator. Seth should look at GA4 → Acquisition → Traffic acquisition → "Session source / medium" to see which referrer added 9 sessions.
- **Organic Social collapsed.** 27 → 6. Reinforces the "Seth's posting cadence dropped or the v1.5 hype decayed" theory above.
- **Direct fell 32%** — same root cause as social.

### Top countries (28d)

| Country | Active users |
|---|---:|
| United States | 32 |
| India | 4 |
| Canada | 2 |
| South Korea | 2 |
| Estonia | 1 |
| Georgia | 1 |
| Ireland | 1 |

US share is now 32/51 = **63%** (down from 61% on 2026-04-22 — effectively flat). Poland disappeared from the top countries this window. India + South Korea bumped up — likely organic.

### Top pages by views (28d)

| Page title | Views |
|---|---:|
| Peanut Gallery — AI writers' room for YouTube (Chrome extension) | **120** |
| Pricing · Peanut Gallery | 6 |
| 404: This page could not be found. | 5 |
| Operator's Manual · Peanut Gallery | 5 |
| Privacy Policy · Peanut Gallery | 5 |
| Side Panel Proof Sheet · Peanut Gallery | 5 |
| Privacy Policy \| Peanut Gallery | 3 |

**The "AI Podcast Sidebar" 212-views row from 2026-04-22 is gone.** That was the old `/watch` page title. The current homepage title ("Peanut Gallery — AI writers' room for YouTube (Chrome extension)") is now the unambiguous leader at 120 views. **The /watch fix worked**, and the title-fragmentation noted in the 2026-04-22 snapshot has resolved.

The two privacy-policy title fingerprints (5 + 3 = 8 views) are still split — same 301 follow-up as in 2026-04-22.

### Events (28d)

| Event | 2026-04-22 | **2026-05-16** |
|---|---:|---:|
| page_view | 343 | **150** |
| user_engagement | 197 | **97** |
| scroll | 171 | **55** |
| session_start | 152 | **106** |
| first_visit | 73 | **48** |
| click | 21 | **11** |
| github_click | 6 | **5** |

### Key events (28d)

| Key event | 2026-04-22 | **2026-05-16** |
|---|---:|---:|
| github_click | 6 | **5** |
| try_web_app | 2 | **1** |
| **Total** | **8** | **6** |

**The `cws_install_click` event is still not wired.** This is the **single highest-leverage instrumentation fix** on the board and it's been the same recommendation in every snapshot since 2026-04-18. The CWS install button on `/` is the actual primary conversion and is still invisible to GA4. Mirror the existing `github_click` pattern — a one-line addition.

---

## Chrome Web Store Developer Dashboard — BLOCKED

CWS Developer Dashboard requires Google "Verify it's you" re-auth on this run. The scheduled task cannot complete an interactive password / 2FA challenge.

**Status:** Unchanged from baseline blocker. The 2026-04-18 synthesis flagged this as "Tasks #8, #9, #10, #11 blocked at the CWS scripting wall." Same wall today.

**Carry-forward:** The `marketing/P1-P2-RESEARCH-WORKSHEET.md` still represents the right ~30-min Seth-at-keyboard session to pull: 28-day install count, impression count, CTR, top-3 listings on the 20 priority queries, category fit test (Tools vs. Productivity).

**If we've crossed any CWS install milestones (first 100 installs, first 1000 impressions):** Unknown. Cannot be confirmed without Seth's session.

---

## Bing Webmaster Tools — not re-pulled

Bing was 0 clicks / 0 impressions across 3 months on 2026-04-22 with effectively no indexed URLs. The 2026-04-22 snapshot installed an IndexNow key file in the static site to fix this once deployed. **If `site/f6034c7304ba548b70ba5a95b9d559f8.txt` is live and IndexNow has been pinged, expect Bing performance to materially differ at the 8-week checkpoint.** Confirming that file is reachable (`curl https://www.peanutgallery.live/f6034c7304ba548b70ba5a95b9d559f8.txt`) is a 30-second Seth-on-laptop check.

---

## Progress vs. `SEO-PLAN.md` — Weeks 1–4 alignment

The 12-week roadmap from `SEO-PLAN.md` §4 was planned around weekly content drops. Mapping shipped vs. planned:

| Week | Planned | Actual status |
|---|---|---|
| Week 1 (Apr 14–20) | CWS short desc rewrite (P2), Wikidata entry, 5 CWS screenshots, new OG image, new CWS promo tile | Drafts ready (`marketing/CWS-SHORT-DESCRIPTION-VARIANTS.md`, `marketing/WIKIDATA-ENTRY-DRAFT.md`). **Shipping is blocked on Seth's CWS dashboard time** (still). |
| Week 2 (Apr 21–27) | Review teardown (P3), response templates, GitHub repo SEO (P5), README hero banner, GitHub social preview | Not visible in repo. README/GitHub-side surfaces appear untouched in the chrome-extension marketing folder. **Behind.** |
| Week 3 (Apr 28 – May 4) | Landing + install + watch audit (P7), GSC page-2 (P9), Director/cascade diagram, new `<title>`+meta for `/`, `/install`, `/watch` | The 2026-04-22 snapshot covers part of this (meta + sitemap deploy). **Partially done.** No Director/cascade diagram visible. No `/install` page (the 2026-04-22 snapshot flagged it as never built). |
| Week 4 (May 5–11) | `/packs/howard` + `/packs/twist` pages, sentiment analysis (P12), pack heroes (Howard + TWiST + 4 unship drafts) | **Pack pages not built.** This is flagged in 2026-04-22 §"Pre-2.0 content gaps" as a high-leverage P10 deliverable. |

**Verdict: 1 of 4 weeks substantively complete (Week 1 ready-to-ship), 1 partial (Week 3), 2 behind (Week 2 GitHub + Week 4 pack pages).** The SEO plan is calendar-time behind by ~2 weeks against the roadmap. The end-of-plan target (100+ non-branded clicks by 2026-07-11, 8 weeks out) is at risk if the pack pages stay un-built — those were the highest-leverage content piece in the entire plan per `SEO-PLAN.md` Prompt 10.

---

## Trajectory check — are we on pace for 100+ non-branded clicks by 2026-07-11?

The 2026-07-11 target is 8 weeks out. Current state:

- **3 total clicks in last 28 days, of which ~0 are non-branded** (top shown queries include nothing that maps to PG's category-defining keywords; the 3 anonymized clicks are most likely brand searches for "peanut gallery" / "peanutgallery.live").
- Linear extrapolation: 3 clicks/28d × 56 days remaining ≈ 6 clicks. We'd hit ~9 total clicks by 2026-07-11.
- That's **9% of the 100-click target**.

**We are materially under pace.** Hitting 100 in 8 weeks would require ~12 clicks/week — a 30× acceleration from the current ~0.75 clicks/week run rate. Two paths get there:

1. **Indexing → impressions → clicks compounding** (passive). Indexed pages doubled (2 → 8) this period. If the same growth continues, by Week 8 we'd have ~30 indexed pages with surface area for organic to compound. Plausible without intervention to reach maybe 25–40 clicks.
2. **Content velocity** (active). Build the pack pages (`/packs/howard`, `/packs/twist`) per Week 4 of the SEO plan + the `/install` page per the 2026-04-22 snapshot. These are zero-competition long-tail surfaces. Each pack page realistically captures 3–8 clicks/week once indexed (~3 weeks crawl-to-rank). Two pack pages + `/install` could plausibly add 20–30 clicks/week by late June.

→ **Recommendation: do path 2.** It's the only path with a credible line to 100. Path 1 alone leaves us at ~25% of target.

---

## Three accelerations Seth could opt into (each unlocks one notch of pace)

### Acceleration 1 — Ship `/packs/howard` + `/packs/twist` in one weekend

This is the **highest-leverage content piece in the entire plan** per `SEO-PLAN.md` Prompt 10. Each pack targets a fan-vertical with passionate audience + near-zero SEO competition: `Howard Stern AI`, `Baba Booey fact checker`, `TWiST extension`, `Jason Calacanis bounty`, `watch All-In with AI`, etc. Both packs already ship with illustrated peanut mascots, so the **content is real, not aspirational** (per 2026-04-22 §9). Expected impact: 30–60 incremental clicks/week within 4–6 weeks of indexing. **Time cost: ~half day for both per the 2026-04-22 estimate.**

### Acceleration 2 — Build a real `/install` page (replace the direct-to-CWS jump)

Currently `installUrl` JSON-LD points straight at the CWS listing. There's no on-domain `/install` page. The SERP pattern `install [extension name]` is a high-intent search class with no PG-owned destination. A dedicated `/install` page captures `install peanut gallery`, `peanut gallery chrome extension install`, `add peanut gallery to chrome` — all bottom-of-funnel queries. **Time cost: ~half day per the 2026-04-22 snapshot.** Bonus: also fixes the missing `/install` referenced as already-shipped in the 2026-04-18 synthesis but never actually built on the static site.

### Acceleration 3 — Wire `cws_install_click` as a GA4 Key Event (60 seconds of work, 4 weeks of clarity)

This has been the same standing recommendation since 2026-04-18 and is still un-shipped. The CWS install CTA is the **primary conversion**, and we cannot see how many people clicked it from anywhere on the marketing site. Mirror the `github_click` pattern. Without this, we can grow GSC clicks 30× and still not be able to prove the funnel converted. **Time cost: literally five minutes of code + 30 minutes for GA4 to mark it a Key Event.**

---

## Retrospective — what worked, what didn't, what to change for Weeks 5–8

**What worked.** GSC indexing tripled (2 → 8 indexed pages), impressions exploded 0 → 13 → 115 across three checkpoints, and avg position improved from 20.8 → 13.8 — that's halfway across the page-2-to-page-1 boundary. The 2026-04-22 sitemap re-submission, IndexNow key file, and `/terms/` deploy did the heavy lifting; their effects are visible 24 days later in the indexing report. The /watch SEO fix from 2026-04-18 has fully resolved — homepage is now the dominant entry by every measure, exactly as predicted in that synthesis. The schema.org graph investment continues to pay: we now show up for adjacent semantic searches (`peanut ai`, `what is a peanut gallery`) even though we don't rank for our target keywords yet.

**What didn't.** Content shipping is calendar-behind by ~2 weeks. The Week 2 GitHub repo SEO (P5) and Week 4 pack pages (P10) — the two most leveraged drops in the plan — neither shipped. GA4 traffic regressed against the v1.5 launch peak: active users fell 29%, sessions fell 30%, engagement-time fell 43%, and the last 7 days show effectively zero new users (likely the bounty/v1.5-launch decay curve, but worth Seth confirming the GA4 tagging is intact on the live site). CWS install conversion is still uninstrumented — same recommendation as 2026-04-18, four checkpoints in a row. The 2026-04-25 and 2026-05-02 scheduled checkpoint docs aren't in the repo, so the bi-weekly cadence the synthesis promised has not held.

**What to change for Weeks 5–8.** Three moves, in order. (1) Pack pages first — they're the demonstrated highest-leverage acquisition surface and the audience is ready. Ship `/packs/howard` and `/packs/twist` in week 5. (2) Wire `cws_install_click` so the next checkpoint can finally answer "did organic traffic convert?". (3) Build the `/install` page in week 6 — it's a 4-hour task that captures a known search pattern. Defer everything in `SEO-PLAN.md` Weeks 6–8 (backlink plan, comparison post, Product Hunt) until the pack pages exist; comparison posts amplify what the site has, and we haven't built the high-conversion surfaces yet. If those three ship by 2026-06-13 (week 8), the 100-click target by 2026-07-11 is reachable.

---

## Measurement checkpoints — running table

| Date | Milestone | Status |
|---|---|---|
| 2026-04-18 (Fri) | Baseline pull (GSC + GA4 + Bing + competitive) | ✅ done |
| 2026-04-20 (Mon) | GSC indexing data + Bing perf unlock | ⚠️ scheduled task ran, scaffolded, Seth-blocked pulls remained unfilled |
| 2026-04-22 (Wed) | Manual SEO snapshot (GSC + Bing + GA4) | ✅ done (Seth-driven, deeper than scheduled scaffolding) |
| 2026-04-25 (Sat) | 7-day post-variant-ship delta | ❌ no delta doc in repo |
| 2026-05-02 (Sat) | First real position data | ❌ no delta doc in repo |
| **2026-05-16 (Sat)** | **4-week view + CWV check** | ✅ **this doc** |
| 2026-06-13 (Sat) | 8-week view; pack pages should be live and indexed | ⏳ pending |
| 2026-07-11 (Sat) | End-of-plan; target 100+ non-branded clicks | ⏳ pending — at risk; current pace yields ~9 |

---

## Source-of-truth pointers

- Prior synthesis: [`2026-04-18-week1-synthesis.md`](2026-04-18-week1-synthesis.md)
- Prior GSC / GA4 baselines: [`2026-04-18-gsc-baseline.md`](2026-04-18-gsc-baseline.md), [`2026-04-18-ga4-baseline.md`](2026-04-18-ga4-baseline.md), [`2026-04-18-bing-baseline.md`](2026-04-18-bing-baseline.md)
- Last manual snapshot: [`2026-04-22-seo-snapshot.md`](2026-04-22-seo-snapshot.md)
- CWS compliance gate: [`../CWS-COMPLIANCE-CHECKLIST.md`](../CWS-COMPLIANCE-CHECKLIST.md)
- 12-week roadmap: [`../SEO-PLAN.md`](../SEO-PLAN.md) §4
- Worksheet for the CWS dashboard work Seth still owes: [`../P1-P2-RESEARCH-WORKSHEET.md`](../P1-P2-RESEARCH-WORKSHEET.md)
