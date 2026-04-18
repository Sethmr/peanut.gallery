# Peanut Gallery — SEO Plan

> Built from the 20-prompt local-SEO framework, stripped of every local-business assumption that doesn't apply to a free Chrome extension, and re-pointed at the channels that actually move the needle for this product: Chrome Web Store search, Google organic, GitHub, developer communities, and podcast-fan SERPs.
>
> **Claude Design (research preview, launched 2026-04-17, Opus 4.7) is the asset production engine for this plan.** Every visual deliverable — CWS screenshots, OG image, README hero, pack page heroes, blog heroes, Product Hunt gallery, pitch decks — gets generated through Claude Design with a single shared design system so the brand doesn't drift. Setup is a Week 1 task. See §3.5.
>
> **Read this first, then run prompts in the order in §6.** Every prompt has Peanut Gallery's specifics pre-filled — no `[your business name]` placeholders.

---

## 1. Business context (the "never ask me this again" block)

Paste this at the top of any SEO session so the model has the full picture without re-asking.

**Product basics**

- Product name: **Peanut Gallery**
- Tagline: *"AI writers' room for YouTube."*
- Type: Free Chrome extension (MV3, Side Panel API) + Next.js 15 reference web app
- Website: https://peanutgallery.live
- Chrome Web Store: https://chromewebstore.google.com/detail/peanut-gallery/jjlpinlhfiheegiddmddkgfialcknagh
- GitHub: https://github.com/Sethmr/peanut.gallery
- License: MIT (open source)
- Version shipped: v1.4.0 "Grok & Stability" (2026-04-18); v1.5 "Smart Director v2" in canary
- Launched: April 2026 — this is a brand-new listing, not an established brand
- Team size: Solo (Seth Rininger, sethr@hey.com, https://sethrininger.dev)

**What it does**

Captures a YouTube tab's audio silently via `chrome.tabCapture` → Deepgram Nova-3 transcribes → a rule-based Director routes each moment to the best-fit persona from a 4-slot cast (producer / troll / soundfx / joker) → responses stream back to Chrome's side panel next to the video. Two persona packs ship: Howard Stern staff (default) and This Week in Startups (Jason Calacanis, Molly Wood, Lon Harris, Alex Wilhelm).

**Primary audience**

1. TWiST listeners (the bounty audience — $5k + guest spot from @jason)
2. Howard Stern fans (default pack)
3. Podcast / YouTube-interview viewers who want a writers' room vibe
4. Indie devs / AI hobbyists interested in multi-LLM orchestration, Director pattern, open-source Chrome extensions
5. Streamers (secondary — works on Twitch / Kick via tab capture, not yet marketed)

**Pricing / monetization**

Free. BYOK (bring your own keys). ~$1.15 in API costs per 2-hr episode passed directly to providers. No subscription, no middleman. Market validator for future paid tier: Questie AI at $0.80/hr, 25k+ paid users.

**Top 5 keywords to own**

1. `YouTube AI sidebar`
2. `AI Chrome extension`
3. `AI writers' room` / `AI writers room`
4. `AI reacts to YouTube`
5. `YouTube fact checker` / `live YouTube transcription`

Secondary tier: `Chrome side panel extension`, `AI commentary YouTube`, `Howard Stern AI`, `TWiST extension`, `YouTube AI assistant`, `Jason Calacanis bounty`.

**Known rank position:** unknown — GSC is wired up (layout.tsx verification token present) but 30-day data hasn't been pulled yet. Prompt 12 closes this gap.

**Direct + adjacent competitors**

| Competitor | URL | Surface | Why they matter |
|---|---|---|---|
| Dmooji | https://dmooji.com | Chrome + Firefox ext, YouTube danmaku-style AI reactions | Closest direct competitor; proves the category |
| Questie AI | https://questie.ai | Desktop AI gaming companion | Pricing validator ($0.80/hr × 25k paid users) |
| ai_licia | https://ailicia.live | Twitch AI co-host | Broadcaster-facing mirror of PG's audience-facing product |
| NotebookLM | https://notebooklm.google.com | Generates podcasts from docs | Dominates "AI + podcast" mindshare; different function, same audience |
| ChatTube / Glarity / Glasp / BibiGPT | various CWS listings | YouTube summarizer extensions | Shared CWS discovery surface — we compete for the same search slots |

Full competitive landscape: [`docs/COMPETITIVE-LANDSCAPE-2026-04-18.md`](../docs/COMPETITIVE-LANDSCAPE-2026-04-18.md). Refresh every 90 days.

**Biggest SEO problem right now (honest):** brand new listing with near-zero backlinks, unverified CWS reviews velocity, no content footprint beyond the landing page, and entity signals haven't had time to compound. Every compounding play (backlinks, reviews, content) is at zero.

**Already in place (do not re-do)**

- GA4: `G-3R9CK4LRGF` (layout.tsx)
- GSC verified (token in layout.tsx)
- Schema markup: `SoftwareApplication`, `FAQPage` (7 Qs), `VideoObject` (demo + bounty announcement)
- `robots.ts` + `sitemap.ts` for 4 pages (`/`, `/install`, `/watch`, `/privacy`)
- OG + Twitter cards with `og-image.png`
- Favicon / apple-touch-icon / 192 / 512
- CWS listing copy: [`marketing/cws-listing.md`](cws-listing.md) — the canonical source for CWS title/description/keywords

**How I want you to work** (same as Seth's original):

- Quick wins before long plays unless asked otherwise.
- Every recommendation gets impact (high/medium/low) + time-to-see-results.
- Competitor comparisons go in spreadsheet format (one row per competitor, one column per attribute).
- When unsure, say so — don't guess.
- Never ask for this context again. Reference this file.

---

## 2. What the template got wrong for Peanut Gallery

The 20-prompt framework was built for plumbers, HVAC, contractors — local service businesses with a Google Business Profile, service areas, phone numbers, and a map pack to compete in. **Peanut Gallery has none of that.** Below is the triage.

**Removed entirely (not applicable):**

| Original prompt | Why it doesn't apply |
|---|---|
| P1 — GBP category audit | No Google Business Profile. PG is a digital product, not a local business. |
| P2 — GBP attributes audit | Same. |
| P5 — GBP posts strategy | Same. GBP posts don't exist for software products. |
| P6 — GBP services section | Same. |
| P7 — GBP description | **Replaced by** CWS description optimization (Prompt 7-R below). Canonical copy already lives in [`marketing/cws-listing.md`](cws-listing.md). |
| P8 — GBP photo audit | **Replaced by** CWS screenshot + promo tile audit (Prompt 8-R below). Requirements live in [`SCREENSHOTS.md`](../SCREENSHOTS.md). |
| P11 — Service + city page builder | No service areas. Pg is global. Replaced by "Persona pack landing pages" (Prompt 11-R) — pages targeting fans of specific shows (All-In, Acquired, Lex Fridman, Hard Fork). |
| P15 — Local citation audit | No NAP to sync. Replaced by "Software directory + citation audit" (Prompt 15-R) — Product Hunt, AlternativeTo, Slant, G2 categories, AI-tools directories. |
| P16 — Local search intent mapping | Intent mapping itself stays; the *local* qualifier comes out. See Prompt 16-R. |

**Kept as-is or lightly adapted:**

- P3 — Competitor review teardown → **CWS + Product Hunt reviews**
- P4 — Review response strategy → **CWS review responses** (analogous pattern, different surface)
- P9 — Keyword gap audit → kept, retargeted at PG's competitor set
- P10 — Money page audit → kept, scoped to the 4 pages we have (plus the blog we're about to build)
- P12 — GSC page-2 goldmine → kept
- P13 — Review sentiment analysis → kept, pointed at Dmooji + YouTube-AI-extension reviews
- P14 — Competitor backlink audit → kept, huge lever for open-source / dev tools
- P17 — Content gap analysis → kept
- P18 — Entity optimization → kept, critical for a new brand
- P19 — Competitor posting patterns → **retargeted from GBP to X + LinkedIn + HN + Reddit + dev.to**
- P20 — Monthly SEO report → kept, metric mix adjusted

**Added (extension/OSS-specific, not in original):**

- **P1-NEW — Chrome Web Store category + ASO audit** (the single most important surface for PG discoverability)
- **P2-NEW — CWS keyword-slot optimization** (all 15 search-term slots + tag fields)
- **P5-NEW — GitHub repo SEO** (README, topics, About, releases — all Google-indexed)
- **P6-NEW — Developer-community content plan** (HN Show HN, r/chrome_extensions, r/selfhosted, r/LocalLLaMA, Indie Hackers, dev.to, Hashnode)
- **P11-R — Persona pack landing pages** (one page per pack that fans of a specific show would search for)

Everything renumbered in §3 for clarity.

---

## 3. The Peanut Gallery prompt library (20 prompts, re-cast)

Run these in Chrome with the tools specified. Every prompt has PG's URLs, keywords, and competitors already filled in.

### Part A — Chrome Web Store ASO (prompts 1–4)

> Chrome Web Store search is the single biggest discovery surface for a browser extension. Ranking for `AI Chrome extension` or `YouTube AI sidebar` inside the CWS matters more than ranking for them on google.com — the intent is much closer to install.

#### Prompt 1 — CWS category + competitor listing audit

"Open Chrome and go to the Chrome Web Store at https://chromewebstore.google.com. Run these searches one by one: `AI chrome extension`, `youtube ai sidebar`, `youtube ai`, `ai reacts to youtube`, `youtube fact checker`, `ai commentary`, `chrome side panel extension`. For each search, record the top 20 listings and extract: listing name, developer/publisher, stated category (Productivity, Entertainment, Developer Tools, Social & Communication, etc.), number of ratings, average star rating, number of users (e.g. '10,000+ users'), whether it uses the Chrome Side Panel API or a popup, whether it advertises AI/LLM integration, and the first 10 words of the short description.

Put the output in a spreadsheet with one tab per search query. Columns: rank, listing name, category, users, rating count, avg stars, side-panel vs popup, AI advertised (yes/no), opening phrase.

Then compare my listing (Peanut Gallery, https://chromewebstore.google.com/detail/peanut-gallery/jjlpinlhfiheegiddmddkgfialcknagh) against the top 5 for each query. Tell me:
1. Which category the top competitors are listed under and whether my 'Productivity' category is optimal or whether I should test 'Entertainment' (candidate per [`marketing/cws-listing.md`](marketing/cws-listing.md)).
2. Which competitors have a higher rating+user combo and whether velocity (reviews per month) looks faster than mine.
3. Which listings are using the Side Panel explicitly as a selling point vs those still using a popup — this is a differentiator I should be louder about.
4. A prioritized list of changes to my CWS listing ranked by expected impact (high/medium/low) with time-to-effect (CWS search rankings typically react within 1-2 weeks)."

**Why this matters:** CWS category is harder to change than Google Business Profile category (requires a re-submit), but the category decision gates everything else. If Entertainment ranks PG against Dmooji and Productivity ranks it against summarizer tools, pick based on where PG is relatively strongest. Re-run in 30 days if category is changed.

#### Prompt 2 — CWS keyword-slot + short-description optimization

"Open Chrome and pull my current Chrome Web Store listing at https://chromewebstore.google.com/detail/peanut-gallery/jjlpinlhfiheegiddmddkgfialcknagh. Extract the short description (132 chars), the long description, the category, and any visible search-term slots. Compare against the canonical copy in [`marketing/cws-listing.md`](marketing/cws-listing.md) — flag any drift.

Then for these 3 direct/adjacent competitor listings (https://chromewebstore.google.com/detail/dmooji/..., plus the top 2 YouTube AI extensions surfaced by Prompt 1), extract the same fields. Put it all in a spreadsheet.

Identify:
1. Keywords my competitors mention in the first 132 chars that I don't.
2. Keywords I mention that ALL competitors mention (table stakes — keep).
3. Keywords I mention that NO competitor mentions (differentiation — keep IF they match real search intent).
4. Keywords all competitors mention that I don't mention at all (gap to close immediately).

Rewrite my short description (≤132 chars, must match `extension/manifest.json`'s `description` field — so the code needs to change too) in 3 variants: (a) keyword-maximalist, (b) conversion-focused with a clear hook, (c) trust-focused leading with 'open source' + 'MIT' + 'BYOK'. All three must include at least 2 of: `YouTube`, `AI`, `sidebar` / `side panel`, `fact-checker` / `writers' room`.

Output the 3 variants plus the expected impact (high/medium/low) for each."

**Why this matters:** the short description is the only copy that shows up in CWS search results. It's the headline that decides whether someone clicks. The three variants let us A/B by swapping every ~30 days and watching install velocity in the CWS dashboard.

#### Prompt 3 — CWS + GitHub review teardown (replaces the review teardown prompt)

"Open Chrome. Pull the last 50 CWS reviews from these 3 competitor extensions: Dmooji, [top AI summarizer from Prompt 1], [second AI tool from Prompt 1]. For each competitor, record:
- Total review count, avg rating, reviews in last 30 / 60 / 90 days (velocity).
- Top 5 features mentioned in reviews.
- Top 3 complaints or pain points.
- Top 5 exact phrases users use when recommending the product.
- Any mentions of specific podcasts / YouTube channels / use cases.

Do the same analysis for my listing (may have low volume — flag that and proceed).

Then also scrape the last 20 GitHub issues on https://github.com/Sethmr/peanut.gallery and the last 10 issues on a Dmooji-adjacent repo if one exists. Extract the same feature/complaint data from user-reported issues since those are effectively product-quality reviews.

Put it all in a spreadsheet (one row per competitor, columns as above).

Final output: the top 10 phrases I should train my own happy users to say in a CWS review (e.g. 'works on TWiST', 'finally an AI that doesn't summarize the video', 'the fact-checker caught Jason mid-sentence') — these go in the review-request email and in the Chrome side panel's 'rate us' flow."

**Why this matters:** CWS review velocity is a ranking signal. Early CWS reviews also set the tone for every future prospect. Training users to mention specific keywords in reviews (TWiST, Howard Stern, side panel, fact-checker) is free CWS SEO.

#### Prompt 4 — CWS review response template system

"Open my CWS developer dashboard → Reviews section. List every review currently on the Peanut Gallery listing. Also check https://chromewebstore.google.com/detail/dmooji reviews to see how they respond.

Build me a response template system with 3 variants each for:
- 5-star reviews that naturally work in `YouTube AI sidebar` or `AI writers' room` phrasing.
- 4-star reviews that acknowledge the gap and invite the user back after the next release.
- 3-star reviews that take accountability and point to the GitHub issue tracker for follow-up.
- 1–2-star reviews that are empathetic, professional, never defensive, and include a link to self-host instructions since some complaints will be about hosted-mode flakiness.

Each response 40–80 words, sounds human, never starts with 'Thank you for your review'. Responses should mention at minimum one of: the Director, the pack system, MIT license, or the fact that users can bring their own keys. Include at least 2 responses that mention TWiST and 2 that mention Howard Stern so the review-response surface feeds keyword signal back to CWS search."

**Why this matters:** CWS developer responses are public and indexed. Every response is another place to naturally include the target keywords without keyword-stuffing.

### Part B — Website SEO (peanutgallery.live, prompts 5–9)

#### Prompt 5 — GitHub repo SEO audit (new)

"Open Chrome. Inspect https://github.com/Sethmr/peanut.gallery as a search surface. Extract:
- Repo name, description, topics (tags), website field.
- README first 500 chars (the bit GitHub shows above the fold).
- Number of stars, forks, watchers.
- Most recent release title + description.
- Whether there's a pinned Discussion / Issue.

Compare against 3 reference open-source Chrome extensions (pick popular ones like `reduct-video/reduct`, `anse-app/anse`, `yihong0618/bilingual_book_maker` or similar with >1k stars).

Tell me:
1. What topics (tags) I should add — GitHub topic search (`https://github.com/topics/ai-chrome-extension`) is a real discovery surface.
2. Whether my README's first 500 chars include my top 3 keywords naturally.
3. Whether the repo description field (shown in search results) is keyword-optimized (currently: check).
4. The exact new `description` + `topics` + `homepage` values to set.

Then write a 300-word 'Awesome README' intro for the top of README.md that includes: the primary keywords, a one-sentence demo, a screenshot reference, and badge shields for `MIT License`, `Chrome Web Store`, `Next.js`, `TypeScript`. Do not rewrite the rest of the README — it's well-structured. Just give me a better hero block."

**Why this matters:** GitHub pages rank in Google for long-tail queries (`open source AI chrome extension youtube`). Repo description, topics, and README intro are the crawled + indexed fields. Ten minutes of work here, compounding traffic for the life of the repo.

#### Prompt 6 — Keyword gap audit

"Open Chrome and log into SEMrush at https://semrush.com (or Ahrefs if that's what I have). Go to the Keyword Gap tool. My domain: peanutgallery.live. Competitor domains: dmooji.com, questie.ai, ailicia.live, notebooklm.google.com (use cautiously — it's a giant), and one smaller direct competitor if you can identify one via Prompt 1.

Filter results to: keywords where competitors rank in positions 1–20 and I don't rank at all; monthly search volume between 50 and 5,000 (the informational-to-commercial sweet spot for a niche SaaS-adjacent product); keyword contains at least one of `ai`, `chrome`, `extension`, `youtube`, `podcast`, `side panel`, `fact check`, `commentary`, `writers room`, `reacts`, `companion`.

For the top 20 keywords, output: volume, KD, which competitor ranks and at what position, whether I have an existing page that could target it with optimization or whether I need a new page, and the 'Action Required' column (Optimize existing / Create new / Blog post / Comparison page / Pack landing page).

Sort by opportunity score = volume × (1 / (KD+1)) × number of competitors ranking."

**Why this matters:** right now PG ranks for basically one keyword — its own name. The gap audit shows every adjacent search where Dmooji/Questie/ai_licia are already pulling traffic that PG could steal with the right page.

#### Prompt 7 — Landing page + /install + /watch optimization (replaces GBP description)

"Open Chrome. Pull the current HTML and rendered content of:
- https://peanutgallery.live (landing — `app/page.tsx`)
- https://peanutgallery.live/install (install — `app/install`)
- https://peanutgallery.live/watch (reference web app — `app/watch`)

For each page extract: `<title>`, meta description, H1, H2s, first 200 words, word count, primary keyword density, internal links, CTA button copy, schema markup present, image alt texts, and whether the primary CTA is 'Install' or 'Try it' or 'GitHub'.

Compare against what Dmooji's landing page does (open https://dmooji.com and extract the same).

Then write me 3 alternative `<title>` tags and 3 alternative meta descriptions for the landing page — all keyword-targeted, all under the 60/155 char limits. Current baselines (from `app/layout.tsx`):
- Title: `Peanut Gallery — AI writers' room for YouTube (Chrome extension)` (62 chars — slightly over)
- Description: the paragraph starting `Free Chrome extension that adds 4 AI personas...`

Variants should test:
1. A brand-forward variant (`Peanut Gallery` first).
2. A keyword-forward variant (`AI Chrome extension for YouTube — Peanut Gallery`).
3. A benefit-forward variant (`Watch YouTube with 4 AI personas — Peanut Gallery`).

Also tell me whether I should turn on ISR / `revalidate` on these pages to help with crawl freshness, and whether the landing page needs anchor links to support featured-snippet capture."

**Why this matters:** the landing page is the only URL most organic Google visitors will ever see. The meta title is currently slightly too long (62 chars) and gets truncated in SERPs. A keyword-forward variant in the first half of the title would double the click-through from `youtube ai sidebar` queries.

#### Prompt 8 — CWS screenshot + promo tile audit (replaces GBP photo audit)

"Open Chrome. Pull my current CWS screenshots (5 × 1280x800 per [`SCREENSHOTS.md`](SCREENSHOTS.md)) and promo tiles. Pull Dmooji's, ai_licia's, and the top AI summarizer from Prompt 1.

For each set record: total screenshot count (max 5 on CWS), whether each screenshot has caption overlay text, caption readability (font size at thumbnail render ≈ 128×80), whether screenshots show the side panel specifically or a popup, whether any screenshot features a recognizable YouTube creator or show (social proof by association), whether screenshots include motion blur / arrows / annotations to guide the eye, and whether the first screenshot works as a standalone 'why you'd install this' image.

Compare and tell me:
1. Which of my 5 screenshots is the weakest (likely the one that communicates least at thumbnail size).
2. A shot list for a new screenshot batch — specific frames to capture, exact caption text, whether to include a screenshot of the debug panel (operator cred) or skip it.
3. Whether the CWS promo tile (if present) is working harder than the default.
4. Whether to produce a 15-second hero video demo — CWS accepts one, most competitors skip this, and motion dramatically outperforms static on the listing page."

**Why this matters:** CWS listing CTR is almost entirely driven by the first screenshot + the short description. Replacing a low-signal screenshot with one that shows the side panel next to a recognizable TWiST/Stern moment is a 1-hour task that meaningfully lifts install rate.

#### Prompt 9 — Money page audit (GSC-driven)

"Open Chrome. Log into https://search.google.com/search-console for property peanutgallery.live. Date range: last 3 months (pad with 'last 28 days' if the property is too new). Export every query + page + clicks + impressions + avg position.

For each of my 4 current pages (`/`, `/install`, `/watch`, `/privacy`), tell me:
- What queries it ranks for.
- Any keyword it's ranking for that doesn't match the page's primary intent (cannibalization or accidental ranking).
- The keyword with the biggest 'impressions but low CTR' gap — that's a title/meta fix.
- The keyword closest to breaking into the top 10 — that's the next content-strengthening target.

Then give me a 30-day sprint:
- Week 1: 3 title/meta rewrites (exact new copy, not instructions).
- Week 2: content additions to pages under 500 words (the landing page is likely fine; `/install` may be thin).
- Week 3: internal linking fixes — specifically, does the landing page link to `/install` with the anchor text `Install on Chrome` and does `/watch` link back to `/`?
- Week 4: prep for the blog launch (§ Part C, P14)."

**Why this matters:** 4-page sites have zero tolerance for cannibalization. The page-2 goldmine approach works the same way it does for a 400-page site, the numbers are just smaller.

### Part C — Content + authority (prompts 10–14)

#### Prompt 10 — Persona pack landing pages (replaces P11 service+city pages)

"I want to build a landing page for each persona pack Peanut Gallery ships. Current packs: Howard (default) and TWiST. Planned packs per [`docs/COMPETITIVE-LANDSCAPE-2026-04-18.md`](../docs/COMPETITIVE-LANDSCAPE-2026-04-18.md): All-In, Acquired, Hard Fork, Lex Fridman. These are SEO gold — every fan of those shows is a qualified install.

For each existing + planned pack, write a dedicated landing page at `peanutgallery.live/packs/<pack-slug>`:
- URL slug: `/packs/howard`, `/packs/twist`, `/packs/all-in`, `/packs/acquired`, `/packs/hard-fork`, `/packs/lex-fridman`.
- `<title>` ≤60 chars: pattern `Watch [Show Name] with an AI writers' room — Peanut Gallery`.
- Meta description ≤155 chars: hook + install CTA.
- H1: `The Peanut Gallery pack for [Show Name]`.
- Opening 100 words: who the show is for, what the 4 personas are, what they do uniquely during this show.
- 'The cast' section: 4 persona cards mirroring `README.md` format (slot / character / model / role), 40 words each.
- 'Sample reactions' section: 3–4 fake example fires in the show's voice (use the transcript style from `scripts/fixtures/twist-episode-sample.txt` as template for the TWiST pack).
- FAQ section: 4 questions specific to that show's audience.
- CTA: 'Install on Chrome' → CWS link + 'Try the web app' → `/watch`.
- Internal linking: link back to `/` and to 2 other pack pages.

For each pack also give me: 3 long-tail keywords the page should own (e.g. `All-In Podcast AI reactions`, `watch Acquired with AI`, `Lex Fridman AI fact checker`), the JSON-LD `WebPage` + `SoftwareApplication` schema to embed, and 3 external outreach targets (the show's subreddit, a fan Discord, the host's X reply surface).

Ship the Howard + TWiST pages first since those packs actually exist. The others are content-ready waiting for the packs to land in v1.5 / v1.6."

**Why this matters:** this is the single highest-leverage content play PG has. Every fan search for `[show name] AI`, `watch [show name] with AI`, `[show name] fact checker` is a qualified install with near-zero competitive noise. Six pages, six durable organic-traffic assets, and a concrete reason to ship more packs.

#### Prompt 11 — GSC page-2 goldmine

"Open Chrome → GSC → peanutgallery.live → last 90 days. Identify every query where I rank positions 11–20 with ≥ 50 impressions per month.

For each page-2 query, open the page currently ranking and tell me:
- Is the query in the `<title>`? In the H1? In the first 100 words?
- Word count of the page.
- Pages internally linking to it.
- Current meta description.

Then build a 30-day optimization sprint, same rules as Prompt 12 in the original framework: exact copy, not instructions. Since PG has only 4 indexed pages today the output may be short; in that case expand into 'queries at position 21-40 where PG has a real chance with minor content additions'."

**Why this matters:** page 2 is the closest thing to free traffic. A 2-week-old Next.js site probably has few position-11-to-20 keywords, but by the time the pack pages from Prompt 10 are indexed (4–8 weeks), this audit becomes the monthly maintenance ritual.

#### Prompt 12 — Review sentiment analysis → website copy

"Open Chrome. Pull the last 100 CWS reviews across Dmooji + the top 2 AI YouTube extensions from Prompt 1. Do a deep sentiment pass:
- Top 20 emotional words users use ('finally', 'addictive', 'hilarious', 'weirdly useful', 'replaces the group chat').
- Top 10 specific outcomes ('makes watching solo feel like a watch party', 'catches Jason being wrong', 'funnier than the actual podcast').
- Top 5 pre-install fears ('will it slow the browser down?', 'another AI wrapper', 'will YouTube block this?').
- Top 5 phrases that appear in 5-star reviews but not in 3-star reviews.

Also pull review sentiment for Peanut Gallery (low-volume; flag it).

Compare the language delta.

Then rewrite these PG surfaces using the actual customer language found:
- The landing page H1 + sub-headline (currently not verified in this prompt — open `/` and extract first).
- The CWS short description (3 variants, coordinate with Prompt 2).
- The review-request script shown in the Chrome side panel after a session ends.
- 3 social-proof statements for the landing page that mirror how Dmooji's happy users describe the experience — but re-cast for PG's booth-producer framing."

**Why this matters:** this is the prompt that makes the difference between copy that sounds like a dev wrote it and copy that sounds like something a user would tell a friend. Not optional.

#### Prompt 13 — Backlink audit (competitor-driven)

"Open Chrome → Ahrefs Site Explorer (or SEMrush Backlink Analytics). Pull the dofollow backlink profile for dmooji.com, questie.ai, ailicia.live, and one AI-tools directory (e.g. theresanaiforthat.com).

Filter to: DR ≥ 20, monthly traffic on the linking domain ≥ 100, link type ≠ sitewide (skip footers/sidebars).

Identify:
- Domains linking to ALL 3 competitors that don't link to peanutgallery.live → highest priority.
- Domains linking to 2 of 3 → medium.
- Domains linking to 1 of 3 → opportunity review.

For each high-priority link, tell me: the domain, the URL, the DR, the site type (directory / news / blog / roundup / sponsor / dev-community / PH / HN / AlternativeTo / Slant / G2 category), how the competitor earned it, my realistic chance (high/medium/low), and the outreach channel.

Then build a 90-day link plan:
- Month 1 — 8 easy link plays: Product Hunt launch, AlternativeTo listing, Slant listing, dev.to post, r/chrome_extensions post, Hashnode cross-post, Hacker News Show HN, theresanaiforthat.com.
- Month 2 — 5 medium plays: guest post on an AI tools blog, podcast mention on a smaller show (Indie Hackers, The Changelog), mention in an AI newsletter (Ben's Bites, Superhuman AI, TLDR AI).
- Month 3 — 3 authority plays: pitch to TechCrunch / The Verge / Axios 'open source AI side project' angle; pitch to Jason Calacanis directly on X for the bounty resolution; pitch to a major YouTuber who covers AI tools (Matt Wolfe, The AI Advantage, David Ondrej).

For every outreach target include the exact first email + subject line. Do NOT write a generic 'I'd love to share our product' pitch — each email must reference something specific the target has published."

**Why this matters:** backlinks + domain authority is where PG is most behind. Dmooji has a year-head-start. The 90-day plan gets PG to parity on core directories and differentiation on editorial plays (TechCrunch-class coverage of the bounty story is the nuclear option).

#### Prompt 14 — Content gap → blog launch

"Open Chrome → SEMrush Content Gap tool. Same domains as Prompt 13. Filter: keywords with 50–500 monthly searches, contains a question word (`how`, `why`, `what`, `when`, `is`, `can`, `does`), relates to problems PG solves or adjacent workflows (watching podcasts, AI reactions, writers' rooms, open-source Chrome extensions, AI fact-checking).

For the top 20 content-gap keywords, organize into 3 buckets:
- Problem-aware (`why is jason calacanis always wrong about dates`, `how to watch twist episodes with ai`).
- Solution-comparison (`dmooji vs peanut gallery`, `best ai chrome extensions for youtube`, `ai companion vs ai summarizer`).
- Action-ready (`install peanut gallery`, `how to add ai to youtube side panel`).

For each keyword, output: page title (≤60 chars), URL slug (e.g. `/blog/dmooji-vs-peanut-gallery`), 200-word brief with keyword targeting + secondary keywords + questions to answer + word count recommendation + internal links + bottom CTA.

Priority order: action-ready first (converts immediately), then solution-comparison (high intent), then problem-aware (long tail, durable).

Separately, write me the first comparison post in full: 'Peanut Gallery vs Dmooji — an honest comparison by the builder'. 1,200-1,500 words, honest about where Dmooji is stronger (10,000+ characters, mature danmaku UX, Firefox support), honest about where PG is stronger (Director + cascade, podcast-first, pack system, open source, self-hostable). This is the page that will rank #1 for `peanut gallery vs dmooji` forever because the builder wrote it and competitors won't. Use the competitive landscape doc as the research base."

**Why this matters:** PG has zero blog content. The fastest way to rank for the second tier of keywords is comparison content and honest engineering writeups. Dmooji is the keyword anchor — every person comparing the two is near the decision moment.

### Part D — Community + authority (prompts 15–18)

#### Prompt 15 — Software directory + citation audit (replaces local citations)

"Open Chrome. For each of these directories, check whether Peanut Gallery is listed, and if so, whether NAP-equivalent data (name, website, CWS URL, GitHub URL, tagline, category, pricing=free, open-source=yes) is consistent:

- Chrome Web Store (reference listing)
- Product Hunt (https://producthunt.com — check if submitted)
- AlternativeTo (https://alternativeto.net — list as alternative to Dmooji / NotebookLM)
- Slant (https://slant.co — 'best Chrome extensions for AI', 'best AI podcast tools')
- G2 (https://g2.com — if a relevant category exists for AI browser extensions)
- Capterra / SoftwareAdvice (borderline — only if a category exists)
- There's an AI for That (https://theresanaiforthat.com)
- Futurepedia (https://futurepedia.io)
- AIToolGuru / AITools.fyi / AITopTools.com (pick top 3 by traffic)
- Awesome Chrome Extensions GitHub lists (e.g. `awesome-chrome-extensions`, `awesome-ai-tools`)
- Hacker News Show HN page (track the submission)
- IndieHackers product page
- Microsoft Edge Add-ons store (if MV3 works there — probable)

Put in a spreadsheet. Columns: directory, listed (yes/no), URL if listed, name exact (yes/no), website correct (yes/no), category correct (yes/no), open-source flag set, free-pricing flag set, duplicate listings (yes/no).

Flag every inconsistency. Then rank the 'not listed yet' entries by domain authority and relevance — that's the order to submit.

Also check for fake/duplicate listings scraped from our GitHub README onto random AI directories (common problem for open-source projects) — tell me if any exist, they dilute authority."

**Why this matters:** directories are the backlink/citation floor. Every one of them is a couple of forms to fill out and forget, and collectively they push entity signal. PG is probably listed on zero to two today.

#### Prompt 16 — Search intent mapping (de-localized)

"My product: Peanut Gallery, a free Chrome extension that reacts to YouTube videos with 4 AI personas (fact-checker, troll, sound guy, comedy writer). Primary audience: TWiST / Howard Stern listeners, podcast/YouTube viewers, AI-curious indie devs. Open Chrome → SEMrush (or Ahrefs). Pull all keywords in the `AI + YouTube + Chrome extension + podcast + writers' room` semantic cluster with volume ≥ 20/month.

Categorize each keyword into one of four buyer-journey stages:
- Stage 1 (problem-unaware): `watching podcasts alone is boring`, `youtube fact check extension`.
- Stage 2 (problem-aware): `how to make youtube more interactive`, `ai commentary on videos`, `is there an ai that watches podcasts`.
- Stage 3 (solution-aware): `dmooji alternative`, `youtube ai sidebar vs popup`, `ai companion for podcasts`.
- Stage 4 (ready to install): `peanut gallery extension`, `install youtube ai sidebar`, `chrome ai extension for podcasts`, `free ai chrome extension`.

For each stage, output: total keywords, combined monthly search volume, avg keyword difficulty, top 10 keywords by volume.

Then map stages to PG's surfaces:
- Stage 4 → CWS listing, `/install` page, pack landing pages (P10). Priority #1.
- Stage 3 → comparison posts (P14), AlternativeTo listing (P15).
- Stage 2 → blog educational content (P14 problem-aware bucket), YouTube demo video.
- Stage 1 → long-form problem content, Twitter threads, dev.to posts.

Tell me the 5 Stage-4 keywords I should target for top-3 ranking in the next 90 days and exactly what it takes for each."

**Why this matters:** de-localized intent mapping still works — the "local" qualifier was just filler. The stage split prevents spending content budget on Stage 1 traffic that never converts to an install.

#### Prompt 17 — Competitor content-posting pattern analysis (replaces GBP posting pattern)

"Open Chrome. Pull the last 90 days of public content from these competitor surfaces:
- Dmooji: their X/Twitter (@dmoojiapp or similar — find the handle), their blog if any, their PH launch thread.
- Questie AI: X, LinkedIn, Twitch announcements.
- ai_licia: X, LinkedIn, Stream Deck marketplace updates.

For every post, extract: date, platform, day of week, post type (announcement / demo / testimonial / meme / technical writeup / roadmap), hashtags, media type (video / GIF / screenshot / text), whether a specific creator is tagged, engagement (likes / replies / reposts visible).

Put it in a spreadsheet. Then tell me:
- Which days and times they post most.
- Which post types get the most engagement for each competitor.
- Which creators / shows / podcasts each competitor has paid attention to.
- Content gaps — topics none of the three are covering that PG's positioning (podcast-first, open source, booth-producer Director pattern) is uniquely qualified to own.

Then build me a 4-week posting calendar for PG across X, LinkedIn, dev.to, and the PG blog:
- 3 posts/week on X (mix: demo GIF, technical writeup, show-tagged reaction).
- 1 post/week on LinkedIn (long-form, builder-story angle).
- 1 blog/dev.to post per 2 weeks (coordinated with P14 content plan).
- Every X post should naturally include one of: `@twistartups`, `@jason`, `@lonharris`, `@HowardStern`, or a tag to another podcast whose fans we want to reach."

**Why this matters:** X is the actual bounty-resolution surface. Jason's eyes are there. LinkedIn drives dev-hire-adjacent credibility and backlinks. dev.to is where other indie developers learn about the Director pattern and link back to the repo. Reverse-engineering what's working for competitors removes guesswork.

#### Prompt 18 — Entity optimization

"Open Chrome. First, check if Peanut Gallery has a Google Knowledge Panel by searching `Peanut Gallery chrome extension` and `Peanut Gallery Seth Rininger`. Tell me what appears.

Check if the entity exists on Wikidata: https://wikidata.org/search → `Peanut Gallery`. Report results.

Audit my schema markup at https://search.google.com/test/rich-results for https://peanutgallery.live. Three JSON-LD blocks are currently in `app/layout.tsx`:
- `SoftwareApplication` (product)
- `FAQPage` (7 FAQs)
- `VideoObject` × 2 (demo + bounty announcement)

Tell me what's valid, what has warnings, what's missing. Specifically:
- Is there a `Person` schema for Seth Rininger? If not, add one on an `/about` page.
- Is there an `Organization` schema for Peanut Gallery separate from the SoftwareApplication? Usually helpful.
- Does the SoftwareApplication include `aggregateRating` once CWS reviews exist (after P3 / P4 run)?
- Are the VideoObject entries up to date (check the upload dates, they'll become stale).

Then build the entity plan:
- LinkedIn company page for Peanut Gallery (even solo).
- Crunchbase profile.
- GitHub Sponsors page (if Seth enables sponsorship — optional).
- Wikipedia: probably not notable yet (BLP-adjacent, don't force it). Re-evaluate after the TWiST bounty resolution.
- Wikidata: a lightweight entry referencing the CWS listing, GitHub, and Seth's profile is low-stakes and helps.
- Brand mentions pass: search Google for `\"Peanut Gallery\" chrome` in quotes and record every mention — aim for 25+ unlinked mentions over the next 90 days (forum threads, X posts, dev.to comments)."

**Why this matters:** entity signals are the long-compounding play. In 12 months the difference between 'PG is a brand Google knows' and 'PG is a string Google doesn't resolve' is the difference between ranking #1 for `peanut gallery` vs being beaten by unrelated podcasts named Peanut Gallery. Start early.

### Part E — Measurement (prompt 19–20)

#### Prompt 19 — Monthly performance report

"Open Chrome. Pull last 30 days vs previous 30 days for:

**Google Search Console** (peanutgallery.live):
- Total clicks, impressions, CTR, avg position (deltas).
- Top 10 keywords by clicks.
- Top 10 keywords that improved position.
- Top 10 keywords that dropped.
- Top gained pages and lost pages.

**Chrome Web Store dashboard** (developer account):
- Weekly users (new installs minus uninstalls).
- Install-to-uninstall ratio.
- Average rating delta.
- Reviews received (count + avg stars).
- Country mix (top 5).
- Listing impressions if available.

**GA4** (G-3R9CK4LRGF):
- Organic sessions, direct sessions, referral sessions.
- Top organic landing pages.
- Bounce rate + engagement time on `/` and `/install`.
- Install-button click rate (set up event tracking on the CWS link if not already — tell me if this event is firing).

**GitHub** (peanut.gallery repo):
- Stars delta, forks delta.
- Traffic → Views + Unique visitors.
- Top referring sites (GitHub tracks this).
- Top content — which files are viewed most (probably README + `docs/CONTEXT.md`).

**Social** (X, LinkedIn, dev.to if posting):
- Impressions + engagement deltas.
- Top performing post.

Output a one-page report with:
- 3 wins.
- 3 problems to address.
- The single most important action for next month.
- A line on whether installs from organic went up or down and by how much.

Format should be readable in 5 minutes."

**Why this matters:** installs is the only metric that matters. The CWS dashboard + GSC + GA4 + GitHub traffic all need to roll up into one number per week: new installs. Traffic vanity metrics should never be the headline.

#### Prompt 20 — Quarterly competitive + category refresh

"Every 90 days, re-run [`docs/COMPETITIVE-LANDSCAPE-2026-04-18.md`](../docs/COMPETITIVE-LANDSCAPE-2026-04-18.md) research pass. Specifically:

- Re-check Dmooji, Questie, ai_licia for new features that would narrow PG's differentiation.
- Re-check NotebookLM for a 'react to live-playing audio' mode — Google's most likely leap.
- Re-scan CWS for new entrants in `ai + youtube + chrome`.
- Re-check the LiveCC + multi-party turn-taking research frontier for anything shippable.
- Update the competitive landscape doc with the findings and a dated note.

Then re-run Prompt 1 (CWS category audit), Prompt 6 (keyword gap), and Prompt 13 (backlink audit) to refresh deltas. Most rankings don't move month-over-month but category-level shifts (e.g. a new competitor entering the top 5 CWS results) require a response."

**Why this matters:** the competitive landscape in this category is moving. Three months is the right cadence — long enough for real movement, short enough to respond before a competitor locks in an SEO lead.

---

## 3.5. Claude Design as the asset factory (Week 1 setup, used every week after)

Anthropic's Claude Design launched 2026-04-17 as a research preview on Pro / Max / Team / Enterprise, powered by Claude Opus 4.7. It turns prompts into prototypes, slides, one-pagers, mockups, marketing visuals, social assets, app prototypes, web pages, and "frontier design" (code-powered experiences with voice, video, 3D, special effects). Early reviews are strong for range of output and speed; known rough edges are collaboration (not fully multiplayer yet) and that a messy codebase produces messy output — so we prep a clean design system first.

### Why it belongs early in this plan

The biggest conversion-moving assets in an extension's launch are visual: the CWS first screenshot, the promo tile, the OG image, the README hero, the Product Hunt gallery, and the pack-page hero art. Producing those well used to be a bottleneck (hire a designer, or Figma-wrestle them yourself) — Claude Design collapses that bottleneck. Using one tool with one design system keeps every surface visually coherent, which is itself a trust signal for a new brand with zero brand equity.

### §3.5.1 — One-time design system setup (Week 1, ~1 hour)

Inside Claude Design, create a project called `peanut-gallery` and wire up the design system fields per Anthropic's setup flow. Provide:

- **GitHub repo link:** `https://github.com/Sethmr/peanut.gallery` — Claude Design reads clean codebases to infer visual language.
- **Tailwind tokens (from `tailwind.config.ts` and `app/globals.css`):**
  - `bg-primary` #0a0a0a (page background)
  - `bg-secondary` #141414 (cards)
  - `bg-tertiary` #1a1a1a (hovers)
  - Accent — Baba Booey / producer: `#3b82f6` (blue)
  - Accent — Troll: `#ef4444` (red)
  - Accent — Fred Norris / soundfx: `#a855f7` (purple)
  - Accent — Jackie Martling / joker: `#f59e0b` (amber)
- **Fonts:** Inter (400 / 500 / 600 / 700) for body, Space Grotesk (500 / 600 / 700) for display — matches Google Fonts config already loaded in `app/layout.tsx`.
- **Logo / glyph:** upload `public/icon-512.png` and `public/apple-touch-icon.png`. If a cleaner vector version exists, prefer that.
- **Brand voice notes:** paste the short description from [`marketing/cws-listing.md`](cws-listing.md) plus: *"Dark theme. Lives in Chrome's side panel. Booth-producer energy (not Silicon Valley hero-shot energy). Copy sounds like a late-night writer wrote it, not marketing. Never anthropomorphize the personas with fake faces — use bubble avatars, sine-wave speaking indicators, emoji glyphs."*
- **Reference assets:** upload the current 5 CWS screenshots + `public/og-image.png` so Claude Design has a style baseline.

Save as the default design system for this project. Every asset below inherits from it.

### §3.5.2 — Asset list (mapped to the existing SEO prompts)

Run these through Claude Design once setup is done. Each line is one Claude Design session.

| Priority | Asset | Size / format | Feeds which prompt | Week |
|---|---|---|---|---|
| P0 | CWS screenshot #1 (hero) — side panel next to a recognizable TWiST or Stern moment, caption: *"An AI writers' room for any YouTube video"* | 1280×800 PNG | P8 | 1 |
| P0 | CWS screenshots #2–5 — side panel, live fact-check, silent tab capture, "free, MIT, BYOK" | 1280×800 PNG each | P8 | 1 |
| P0 | CWS promo tile (small) | 440×280 PNG | P8 | 1 |
| P0 | CWS promo tile (marquee, optional but higher-impression) | 1400×560 PNG | P8 | 1 |
| P0 | OG image refresh — replaces `public/og-image.png` | 1200×630 PNG | P7 | 1 |
| P1 | README hero banner + architecture diagram (YouTube → Deepgram → Director → 4 personas → SSE) | 1600×900 PNG | P5 | 2 |
| P1 | GitHub social preview image | 1280×640 PNG | P5 | 2 |
| P1 | Pack page hero — Howard (Stern-booth aesthetic, emoji glyphs in bubbles, not faces) | 1600×900 PNG | P10 | 4 |
| P1 | Pack page hero — TWiST (All-In / VC aesthetic, same bubble treatment) | 1600×900 PNG | P10 | 4 |
| P2 | Pack page heroes — All-In, Acquired, Hard Fork, Lex Fridman (produce as placeholders now, mark pages `noindex` until packs ship) | 1600×900 PNG each | P10 | 4–11 |
| P1 | Director + cascade explainer diagram — for the landing page "how it works" block | SVG + PNG | P7, P14 | 3 |
| P2 | Blog hero #1 — *Peanut Gallery vs Dmooji* | 1600×900 PNG | P14 | 6 |
| P2 | Blog hero #2 — engineering writeup on v1.5 Smart Director v2 | 1600×900 PNG | P14 | 9 |
| P2 | Product Hunt gallery — 6 images (problem, product shot, director diagram, personas, install UX, the bounty story) | 1270×760 PNG each | P13 M1 | 7 |
| P3 | X thread imagery — 4 slides to pin on `@SethRininger` + cross-post to `@twistartups` tag | 1200×675 PNG each | P17 | 7 |
| P3 | Pitch deck — 10 slides, for TechCrunch / Matt Wolfe / Jason Calacanis outreach + the bounty-resolution moment | PDF + PPTX | P13 M3 | 11 |
| P3 | Frontier-design interactive prototype — embedded Director-cascade visualizer (code-powered; Opus 4.7 is specifically strong at this) | React/HTML artifact embeddable in `/` or `/packs/*` | P7, P10 | 10 |

### §3.5.3 — The frontier-design play

Claude Design's marquee differentiator is "frontier design": code-powered, interactive experiences — not just images. For Peanut Gallery, the highest-leverage use is a **Director-cascade visualizer** embedded on the landing page: a tiny animated explainer that shows a sample transcript arriving, the Director scoring each persona, the highest-scoring one firing, and the cascade kicking in with 50% / 35% / 20% probabilities. Nobody in the competitive set has this (Dmooji's "multiple characters react" is narratively shallower). It's the single biggest dwell-time + shareability lever I can think of short of a voice demo. Ship it once the core screenshot + OG work is done.

### §3.5.4 — Where Claude Design does NOT replace existing tools

Keep the boundary clean:

- **Editing the repo's own `app/` UI:** don't let Claude Design regenerate production React components. It's for marketing surfaces, not for your shipping product. The extension + `/watch` UI stays in the normal dev flow.
- **Real persona voice / audio:** v1.6 TTS per persona is a separate effort; don't try to prototype it in Claude Design.
- **Running the SEO audits themselves:** Claude Design produces visuals, not competitor spreadsheets. Prompts 1, 3, 6, 9, 11, 13, 14, 15, 19 still need Chrome + SEMrush/Ahrefs + GSC.

---

## 4. 12-week execution roadmap

**Week 1 — CWS foundation + entity baseline + Claude Design setup**
- Set up the Claude Design system per §3.5.1 (GitHub link + tailwind tokens + fonts + voice notes + reference assets). One-hour setup, every later asset inherits from it.
- Run P1 (CWS category audit), P2 (keyword slots), P18 (entity audit).
- Ship (Claude Design): 5 new CWS screenshots (P8 shot list), new CWS promo tile(s), new OG image replacing `public/og-image.png`.
- Ship (copy): short description rewrite (P2 variant A), Wikidata entry (P18).

**Week 2 — CWS reviews + GitHub**
- Run P3 (review teardown), P4 (response templates), P5 (GitHub repo SEO).
- Ship (Claude Design): README hero banner + architecture diagram, GitHub social preview image.
- Ship (copy): CWS review response batch caught up, GitHub description + topics updated, README hero block rewritten to sit next to the new banner.

**Week 3 — Website core pages**
- Run P7 (landing + install + watch audit), P9 (GSC page-2 for the 4 current pages).
- Ship (Claude Design): Director + cascade explainer diagram for the landing-page "how it works" block (SVG + PNG).
- Ship (copy): new `<title>`+meta for `/`, `/install`, `/watch`; tighten landing page H1 using Prompt 12 language.

**Week 4 — Pack landing pages wave 1**
- Run P10 (pack pages) → ship Howard + TWiST pack pages at `/packs/howard` + `/packs/twist`.
- Run P12 (sentiment analysis) to feed copy into those pages.
- Ship (Claude Design): Howard + TWiST pack heroes; draft heroes for All-In / Acquired / Hard Fork / Lex Fridman pages (held behind `noindex` until those packs ship).

**Week 5 — Directory + citation push**
- Run P15 (software directory audit) → submit to the top 8 missing directories in 1 session.
- Prep Product Hunt launch (date it 2 weeks out to build a teaser list).

**Week 6 — Backlink plan + first comparison post**
- Run P13 (backlink audit) → draft 8 emails for Month 1 links.
- Ship (Claude Design): blog hero for `dmooji-vs-peanut-gallery`.
- Ship `dmooji-vs-peanut-gallery` comparison post (P14 deliverable #1).

**Week 7 — Product Hunt launch + HN Show HN**
- Ship (Claude Design): Product Hunt gallery (6 images) + X thread imagery (4 slides) for launch day.
- Product Hunt launch. Show HN thread same week. AlternativeTo, Slant, TAAFT submissions batched.
- Outreach emails from P13 go out Monday morning.

**Week 8 — Content engine on**
- Run P14 (full content gap) → commit to 2 blog posts per month from here.
- Ship blog posts #2 and #3 (one comparison, one problem-aware).

**Week 9 — Pack pages wave 2 + post schedule**
- Run P17 (posting pattern analysis) → start 4-week posting calendar.
- Ship (Claude Design): blog hero for the v1.5 Smart Director v2 engineering writeup.
- If v1.5 Smart Director v2 is shipped by now, publish the engineering writeup on dev.to (natural backlink magnet).

**Week 10 — Keyword gap + content gap second pass**
- Run P6 (keyword gap) → new list, likely different from Week 1 because the site's footprint is larger now.
- Update pack page titles/H1s based on new keyword data.

**Week 10 — Frontier-design prototype live**
- Ship (Claude Design frontier mode): interactive Director-cascade visualizer embedded on `/` and `/packs/*`. This is the dwell-time + shareability unlock described in §3.5.3.

**Week 11 — Intent mapping + authority outreach**
- Run P16 (intent mapping) to prioritize Stage-4 content.
- Ship (Claude Design): 10-slide pitch deck for TechCrunch / Matt Wolfe / Jason Calacanis outreach + the bounty-resolution moment.
- Start Month-3 outreach (TechCrunch pitch for the TWiST bounty story if PG wins it; Matt Wolfe / The AI Advantage pitch for an extension review).

**Week 12 — Measurement + refresh**
- Run P19 (monthly report) for the full quarter.
- Run P20 (quarterly competitive + category refresh).
- Bank the learnings. Set the next quarter's priorities.

---

## 5. Working notes for whoever runs this

- Every prompt above is already written for Peanut Gallery. Don't re-paste the business-basics block into Claude — just paste the prompt. The context lives here.
- If a prompt returns low-volume data (e.g. P9 / P11 / P19 in the first month), that's expected. The site is new. The prompt still works; the interesting output shows up once the site has 8–12 weeks of GSC history.
- Do not wait for v1.5+ packs to ship before writing their landing pages — write them now, mark them `noindex` until the packs ship, then flip to `index` on launch day for a coordinated content + release push.
- `/watch` is the hosted web app and should stay low-priority in the sitemap (already priority 0.3). The main conversion path is CWS install, not the web app. If `/watch` starts outranking `/` for `peanut gallery`, that's a signal to canonicalize or de-emphasize.
- Never buy links. The entire backlink plan (P13) is earned, not bought. Paid placements on directory sites that clearly sell DR are a negative signal.

---

## 6. Source-of-truth pointers

| Topic | Lives at |
|---|---|
| Canonical product context | [`docs/CONTEXT.md`](../docs/CONTEXT.md) |
| Competitive landscape | [`docs/COMPETITIVE-LANDSCAPE-2026-04-18.md`](../docs/COMPETITIVE-LANDSCAPE-2026-04-18.md) |
| CWS listing copy (canonical) | [`marketing/cws-listing.md`](cws-listing.md) |
| Screenshot requirements | [`SCREENSHOTS.md`](../SCREENSHOTS.md) |
| Public README | [`README.md`](../README.md) |
| Schema markup source | [`app/layout.tsx`](../app/layout.tsx) |
| Sitemap | [`app/sitemap.ts`](../app/sitemap.ts) |

If any of these disagree with this doc, trust `docs/CONTEXT.md` for product facts and this doc for SEO execution.
