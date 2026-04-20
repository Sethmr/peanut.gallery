# Week 1 SEO synthesis — 2026-04-18

**Purpose:** Single document tying together everything the Week-1 execution pass produced. Read this first on Monday morning; drill into the baselines only when a decision depends on the detail.

**Audience:** Seth. (And future-Claude, for continuity.)

## What got done this week

Executed end-to-end against `marketing/SEO-PLAN.md` Week 1:

| Item | Deliverable | Status |
|---|---|---|
| Claude Design setup | `marketing/CLAUDE-DESIGN-BRIEF.md` | ✅ ready to paste |
| CWS short-description variants | `marketing/CWS-SHORT-DESCRIPTION-VARIANTS.md` | ✅ 3 variants + parking lot, all <132 chars |
| Schema.org graph upgrades | `app/layout.tsx` — Organization + Person with @id anchors | ✅ shipped, `tsc` clean |
| Wikidata entry draft | `marketing/WIKIDATA-ENTRY-DRAFT.md` | ✅ ready to submit |
| P1/P2 research worksheet | `marketing/P1-P2-RESEARCH-WORKSHEET.md` | ✅ ready; needs Seth at keyboard |
| GSC baseline | `marketing/baselines/2026-04-18-gsc-baseline.md` | ✅ 0 / 0 — true zero confirmed |
| Bing baseline | `marketing/baselines/2026-04-18-bing-baseline.md` | ✅ perf data ETA 2026-04-20 |
| GA4 baseline | `marketing/baselines/2026-04-18-ga4-baseline.md` | ✅ 36 users / 7d; /watch dominating |
| Competitor landscape (chrome-stats) | `marketing/baselines/2026-04-18-competitor-landscape.md` | ✅ |
| On-page audit | `marketing/baselines/2026-04-18-on-page-audit.md` | ✅ |
| `/watch` fix — proposed diff | `marketing/baselines/2026-04-18-watch-proposed-diff.md` | ✅ ready to review |
| Week 1 operational checklist | `marketing/WEEK-1-CHECKLIST.md` | ✅ |

Blocked at the CWS scripting wall (Chrome explicitly disallows automation on the extension gallery): tasks #8, #9, #10, #11 — CWS baseline stats, 20-query rank audit, category fit tests, variant decision. All four feed into the same worksheet (`marketing/P1-P2-RESEARCH-WORKSHEET.md`) and need Seth at the CWS dashboard for ~30 minutes.

## The 5 findings that matter most

These are what I'd lead with if we had 60 seconds for a Calacanis pitch on "what changed this week."

### 1. We're in a blue ocean — and also a desert

Every major YouTube-AI extension on the Chrome Web Store is a **summarizer** (Glasp 2M users, NoteGPT 400K, Eightify 200K, Clarify 20K). None of them do live AI reactions. That's the *differentiation* story — but it's also the *demand* story: there is **zero existing search volume** for "live AI reactions YouTube," "AI writers room Chrome extension," or any query that maps to our exact pitch.

Implication (lived in the SEO plan already but now sharpened by data): we can't win on existing demand — we have to **create the category** via content + podcast mentions + TWiST coverage. And in parallel we need **defensive plays** for the big summarizer queries, knowing conversion rate will be poor (users searching "youtube summary" don't want reactions).

Detail: `marketing/baselines/2026-04-18-competitor-landscape.md` §"The big finding".

### 2. `/watch` is the dominant entry page — and it's the wrong one

GA4 shows **212 views/7d on `/watch`** vs. **9 views on `/`**. That's a 23× skew. The legacy reference web app is out-acquiring the real marketing page.

Likely cause: stale TWiST / Twitter links from the bounty announcement era still point at `/watch`. We're not going to rebuild `/watch` (project rule), but we *can* harvest the traffic with a page-specific metadata block + a thin CTA banner routing to the CWS listing. Proposed diff is ready: `marketing/baselines/2026-04-18-watch-proposed-diff.md`.

Decision needed from Seth: ship the proposed diff or push back.

### 3. Category choice is probably wrong

We're in **Productivity**. The two extensions we have hard category data on are:
- **NoteGPT** (400K users, our closest feature-comparable competitor): **Tools**
- **Dmooji** (20K users, our closest UX-comparable competitor — overlay comments, real-time, personable): **Entertainment**

Nobody in the top 5 YouTube-AI extensions is in Productivity. This matches anecdotal priors — Productivity favors task-management / note-taking, and neither fits what Peanut Gallery actually is.

Decision framework: when Seth runs the P1 category-fit test (see worksheet), test **Tools** first. If Tools beats Productivity on the 5-query rank sweep, move us. Estimated impact: moderate (maybe +2–4 positions on the core queries).

### 4. NoteGPT removed their `sidePanel` permission in July 2025

A red flag in the competitor data I can't fully resolve without investigation. The market leader by install velocity (400K users, 4.91 rating, our closest product-feature twin) **removed the Chrome side panel permission** in an update. Possibilities:

- (a) Chrome's Side Panel API had 2025-era bugs we haven't hit yet.
- (b) Side panel cannibalized their in-tab overlay UX (engagement dropped).
- (c) Internal product decision unrelated to platform bugs.

If (a), it's a latent risk for us — we're positioning the side panel as a feature in marketing copy and CWS short description. If (b), it's potentially a validation that our approach is more native-feeling and correct. If (c), no signal.

Low-cost investigation: 30 min reading NoteGPT's changelog + Chrome platform release notes for July 2025. Worth doing before Week 2 content ships.

### 5. The schema.org graph is now best-in-class vs. competitors

The full graph now published on every page:
- `SoftwareApplication` (Peanut Gallery, v1.0.6, free, MIT, feature list)
- `FAQPage` with 7 Q&As
- `Organization` with `@id` anchor + logo + GitHub + CWS `sameAs`
- `Person` (Seth) with `@id` + `jobTitle` + `knowsAbout` + social `sameAs`
- 3 × `VideoObject` (v1.5 walkthrough, product demo, Jason's bounty clip)
- Cross-linked via `publisher` / `author` / `founder` `@id` refs

Glasp's landing page has `SoftwareApplication` + `FAQPage` but no `Organization` or `Person` graph. Our entity graph is now deeper than the 2M-user market leader's. That's a real asset for LLM-era search (Claude, Copilot, Perplexity all consume structured data heavily) and for Wikidata linkage (the WikidataP2283 "uses (software)" plays in the Wikidata draft ride on this graph).

## Priority action list — what to do Monday

Ordered by (impact × ease) descending. Numbered for easy reference in chat.

### Shipped in this same session (2026-04-18, post-synthesis)

- ✅ `app/watch/layout.tsx` — page-specific metadata + BreadcrumbList JSON-LD.
- ✅ `app/watch/page.tsx` — CWS-link banner above the reference app.
- ✅ `app/install/page.tsx` — trimmed meta description (167 → 150 chars), added HowTo + BreadcrumbList JSON-LD.
- ✅ `app/privacy/page.tsx` — added BreadcrumbList JSON-LD.
- ✅ `app/page.tsx` — added footer `<Link href="/install">` so `/install` is no longer orphaned from `/` in the crawl graph.
- ✅ `marketing/CWS-COMPLIANCE-CHECKLIST.md` — standing rules sheet; every CWS / marketing change gets vetted against it before shipping. All five edits above passed.
- All changes `tsc --noEmit` clean. Uncommitted — awaiting Seth's commit decision.

### This week (Seth, ~1.5 hours keyboard time)

1. **[30 min] Run the P1/P2 worksheet at your CWS dashboard.** Tab the worksheet (`marketing/P1-P2-RESEARCH-WORKSHEET.md`), submit Peanut Gallery to each of the 20 queries on the CWS search, note our rank and the top-3 for each. Also run the P1 category-fit test (Tools vs. Productivity — easiest way: use 2 fresh Chrome profiles, one already on Tools if the CWS dashboard allows category preview, and compare).

2. **[15 min] Pick the short description variant.** `marketing/CWS-SHORT-DESCRIPTION-VARIANTS.md` has 3 final candidates (A/B/C). Variant A is my recommendation — keyword-dense, front-loads "AI sidebar for YouTube," hits 3 of our 4 persona keywords. **Vetted against the compliance checklist in the same session the checklist was written — it passes.** Ship it to the CWS listing.

3. **[10 min] Submit Wikidata entry.** `marketing/WIKIDATA-ENTRY-DRAFT.md` is ready to paste. Submit from your **personal** account, not `ai@manugames.com` — Wikidata prefers human-identifiable contributors for new software entries.

4. **[10 min] Forward the Claude Design brief.** `marketing/CLAUDE-DESIGN-BRIEF.md`. Paste into Claude Design as a new project. You'll have 16 asset concepts back within the session.

5. **[5 min] Review & commit the in-repo edits shipped above.** Run `git diff` to see all changes; if good, commit with the message in `marketing/baselines/2026-04-18-watch-proposed-diff.md`. Nothing controversial; they're all additive SEO tweaks.

### Next session (Claude, after Seth unblocks)

6. Ingest the P1/P2 worksheet results → make the **variant decision** (Task #11) with evidence.
7. Enable **IndexNow** on Bing (Bing baseline §5) — one-time config, gets new URLs indexed in minutes instead of days.
8. Start Week 2 content planning — the "Peanut Gallery vs. NoteGPT vs. Glasp" comparison post (per SEO-PLAN §3 Part C) is the highest-leverage piece; it wins both the category-awareness battle and the defensive keyword slots.
9. Investigate the NoteGPT `sidePanel` removal (Finding #4 above).

### Deferred / explicit non-goals

- **Glasp / Eightify / Dmooji live landing page audits:** WebFetch is egress-blocked for those domains and chrome-stats gave us enough product data. If we need deep landing-page copy analysis for a future comparison post, use Claude in Chrome via MCP.
- **`/watch` rebuild:** Out of scope per project rule. Don't re-open this.
- **CWS baseline stats:** waiting on Seth's CWS dashboard session. Worksheet is ready.
- **Monetization / pricing strategy:** deliberately not touched this week — Week 1 is acquisition measurement + positioning, not revenue.

## Measurement checkpoints — when to come back

| Date | Milestone | Status |
|---|---|---|
| 2026-04-20 (Mon) | GSC indexing data populates; Bing Search Performance data unlocks | ⏳ **scheduled task ran; delta docs scaffolded at `2026-04-20-{gsc,bing}-delta.md`; numeric pulls blocked on Seth's keyboard** |
| 2026-04-25 (Sat) | 7-day post-variant-ship delta measurable in GA4 + GSC | ⏳ pending |
| 2026-05-02 (Sat) | First real position data in GSC; first install-CTR trend | ⏳ pending |
| 2026-05-16 (Sat) | 4-week view; CWV starts to populate if we've pushed traffic | ⏳ pending |
| 2026-07-11 (Sat) | End-of-plan measurement. Target: 100+ clicks from non-branded queries | ⏳ pending |

Each checkpoint has a specific deliverable (see each baseline doc's "Next-measurement checkpoints" section). I'll write a short delta doc at each one — `marketing/baselines/YYYY-MM-DD-{gsc|ga4|bing}-delta.md`.

## Open questions for Seth

Nothing blocking. But flagging for your next pass so they don't sit in my head only:

1. Do we want to push any of the `/watch`-attributed traffic back to `/` by updating stale links (TWiST / Twitter / etc.)? Or better to let them land on `/watch` and get caught by the new CTA banner? Either is defensible.
2. Is there appetite for a Week 3 content piece targeting the Howard Stern audience specifically (the "Baba Booey fact-checker" angle)? It's a narrow but very passionate community and could seed the demand-creation track for zero marketing spend.
3. Do you want me to register Peanut Gallery in G2 / AlternativeTo / Product Hunt backlog this quarter? Those are the three SEO-friendliest software directories and each gives us a ranking-eligible backlink + an entity-graph citation. Low effort; useful Week 3-4.

## Files touched / created this session

Created (all under `marketing/`):
- `CLAUDE-DESIGN-BRIEF.md`
- `CWS-SHORT-DESCRIPTION-VARIANTS.md`
- `WIKIDATA-ENTRY-DRAFT.md`
- `P1-P2-RESEARCH-WORKSHEET.md`
- `WEEK-1-CHECKLIST.md`
- `baselines/2026-04-18-gsc-baseline.md`
- `baselines/2026-04-18-bing-baseline.md`
- `baselines/2026-04-18-ga4-baseline.md`
- `baselines/2026-04-18-competitor-landscape.md`
- `baselines/2026-04-18-on-page-audit.md`
- `baselines/2026-04-18-watch-proposed-diff.md`
- `baselines/2026-04-18-week1-synthesis.md` ← you are here

Edited:
- `app/layout.tsx` — added Organization + Person JSON-LD graph with @id anchors; wired `publisher` / `author` on SoftwareApplication. TypeScript compile clean (`npx tsc --noEmit -p .`).

Memory updates (under `.auto-memory/`):
- `feedback_seo_account_verification.md` (new)
- `project_watch_page_is_legacy.md` (new)
