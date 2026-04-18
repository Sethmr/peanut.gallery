# Session handoff — 2026-04-18 SEO push + UI redesign

> Paired with (not replacing) `docs/SESSION-NOTES-2026-04-18.md`, which covers
> the earlier v1.3 bug-fixing session. This doc is the SEO / marketing / UI
> redesign session's handoff, written in the final minutes before Seth opened
> Claude Design and we prepared to switch context.
>
> **Read order for a fresh session:** (1) `peanut.gallery/CLAUDE.md` for the
> git lock protocol, (2) `.auto-memory/MEMORY.md` for persistent rules, (3)
> this file for where we stopped, (4) the specific baseline doc you need.

---

## 🚨 Seth's manual queue — blocked on you at the keyboard

These cannot move without Seth sitting at a specific dashboard or UI. Listed in
suggested priority. **Remind me to re-surface this list every few interactions
until the queue drains.**

### In Claude Design (in progress — you just opened it)

- [ ] **Run the generations from [`marketing/CLAUDE-DESIGN-BRIEF.md`](../marketing/CLAUDE-DESIGN-BRIEF.md).**
      Week 1 asset priorities 1–8 are the ship-this-week set (5 CWS screenshots,
      2 promo tiles, 1 OG card). The brief's token table has been refreshed to
      match the orange palette we shipped in `app/landing.css` today — see
      "Design alignment" section below.
- [ ] **Drop in reference images 4 and 5** (Stern writers' room, late-night
      stage composition). Claude Design needs those to anchor the "writers' room
      over SaaS landing page" aesthetic. The brief flags them as Seth-to-provide.
- [ ] **When outputs land, save them to** `marketing/promo/claude-design/2026-04/`
      **with sibling `.json`** (generation prompt + seed + accept/reject note).
      The brief's Outputs Directory section specifies this.

### In Chrome Web Store Developer Dashboard (logged in as `ai@manugames.com`)

- [ ] **Task #8 — Capture CWS baseline stats.** Open the CWS Developer Dashboard
      → Peanut Gallery → Stats. Record today's numbers: weekly installs,
      weekly impressions, 7-day CTR, and top-referring search queries if
      surfaced. Drop them in `marketing/baselines/2026-04-18-cws-baseline.md`
      (new file, template-free — just the numbers in a 5-row table).
- [ ] **Task #9 — Run the 20-query CWS rank audit.** Tab the worksheet at
      `marketing/P1-P2-RESEARCH-WORKSHEET.md`. For each of the 20 queries,
      paste into CWS search, note where Peanut Gallery ranks and the top 3
      competitors for each query.
- [ ] **Task #10 — Run the category-fit test.** Per `marketing/baselines/2026-04-18-competitor-landscape.md`
      §"Category-choice evidence," our competitors split between **Tools**
      (NoteGPT) and **Entertainment** (Dmooji). We're currently **Productivity**.
      Test swapping the category via the CWS listing editor → note the ASO
      rank change on 3–5 representative queries. **Don't publish the swap yet.**
- [ ] **Task #11 — Make + document the variant decision.** After #9 + #10,
      pick between Variant A and Variant B from `marketing/CWS-SHORT-DESCRIPTION-VARIANTS.md`
      and a Productivity-vs-Tools category. Run the result through
      `marketing/CWS-COMPLIANCE-CHECKLIST.md` before submitting, and remember:
      **don't stack CWS submissions** (reference `.auto-memory/reference_cws_review_policy.md`).

### On Bing Webmaster Tools (one-time, 5 min)

- [ ] **Enable IndexNow.** `marketing/baselines/2026-04-18-bing-baseline.md` §5
      flags this — one-time config, gets new URLs indexed in minutes instead
      of days. Worth doing before the Week 2 comparison post ships.

### Publishing the Week 2 comparison post

- [ ] **Finalize + publish** `marketing/content/2026-W2-vs-competitors.md`.
      The draft is written and vetted against the CWS compliance checklist,
      but before publishing:
      - Re-pull chrome-stats numbers for NoteGPT, Glasp, Eightify — if any user
        counts have drifted >5% since 2026-04-18, update the table.
      - Re-read both competitors' CWS listings for feature drift.
      - Wire the `BlogPosting` + `BreadcrumbList` + `FAQPage` JSON-LD when we
        have a blog route to host it on (that route doesn't exist yet — see
        "Open decisions" below).

### Git commits still to land (not currently committed)

There are uncommitted changes on the working tree from this session. None were
committed per the safe-until-Seth-says-ship pattern. See "Files changed" below
for the full list. **Don't commit from within this session** — per
`peanut.gallery/CLAUDE.md`, any commit runs through the lock-prevention
protocol. Seth can commit in his terminal once he's reviewed the diffs.

---

## ⏰ What's running autonomously (scheduled, no Seth required)

Five one-time scheduled tasks were created today. They will fire at 9 AM Pacific
on the listed dates and produce delta docs + short summaries. Each is fully
self-contained and re-reads the relevant baselines + compliance checklist
before acting.

| Date | Task ID | Purpose |
|---|---|---|
| 2026-04-20 (Mon) | `pg-checkpoint-2026-04-20-gsc-bing` | First GSC + Bing data unlock. Writes two delta docs. |
| 2026-04-25 (Sat) | `pg-checkpoint-2026-04-25-variant-delta` | 7-day post-ship delta. Checks /watch:/ ratio, GSC graduation, Variant A/B signal. |
| 2026-05-02 (Sat) | `pg-checkpoint-2026-05-02-position-data` | First trustworthy GSC position numbers + install-CTR trend. |
| 2026-05-16 (Sat) | `pg-checkpoint-2026-05-16-4week-view` | 4-week view, CWV starts populating, Weeks 5–8 recommendation. |
| 2026-07-11 (Sat) | `pg-checkpoint-2026-07-11-end-of-plan` | End-of-plan retrospective vs. 100-non-branded-clicks target. |

Each task is at `/Users/seth/Documents/Claude/Scheduled/<taskId>/SKILL.md` on
Seth's machine. They auto-disable after firing.

---

## State of play — where the SEO push is

**Week 1 checklist:** 18 of 22 tasks complete. The 4 remaining are all in
Seth's manual queue above (CWS dashboard work). Everything autonomously
doable is done.

**Baselines pulled (all 2026-04-18):**
- `marketing/baselines/2026-04-18-gsc-baseline.md` — 0 / 0 confirmed true zero.
- `marketing/baselines/2026-04-18-bing-baseline.md` — perf data ETA 2026-04-20.
- `marketing/baselines/2026-04-18-ga4-baseline.md` — 36 users / 7d; `/watch`
  dominating at 212 views vs `/` at 9 (23× skew).
- `marketing/baselines/2026-04-18-competitor-landscape.md` — chrome-stats pulls
  for NoteGPT (400K), Glasp (2M), Eightify (200K), Dmooji (20K), Clarify AI
  (20K). Blue-ocean finding: nobody else does live reactions.
- `marketing/baselines/2026-04-18-on-page-audit.md` — six action items, P1+P2.
  All applied this session.
- `marketing/baselines/2026-04-18-notegpt-sidepanel-investigation.md` —
  sidePanel removal was UX-driven (DOM overlay swap), not platform retreat.
  Our native-side-panel positioning is stronger than assumed.
- `marketing/baselines/2026-04-18-week1-synthesis.md` — 5 findings, priority
  list, measurement checkpoints, open questions.
- `marketing/baselines/2026-04-18-watch-proposed-diff.md` — applied.

**Standing artifacts shipped this session:**
- `marketing/CWS-COMPLIANCE-CHECKLIST.md` — the pre-publish gate. Re-verify
  canonical Google URLs every 90 days.
- `marketing/CLAUDE-DESIGN-BRIEF.md` — paste-ready project brief for Claude
  Design. **Token table refreshed this session** to match the shipping orange
  palette.
- `marketing/content/2026-W2-vs-competitors.md` — Week 2 comparison post
  draft (Peanut Gallery vs NoteGPT vs Glasp), ~2,100 words, vetted against
  the CWS compliance checklist.

---

## Files changed this session

**Created:**
- `marketing/CWS-COMPLIANCE-CHECKLIST.md`
- `marketing/content/2026-W2-vs-competitors.md`
- `marketing/baselines/2026-04-18-on-page-audit.md`
- `marketing/baselines/2026-04-18-watch-proposed-diff.md`
- `marketing/baselines/2026-04-18-week1-synthesis.md`
- `marketing/baselines/2026-04-18-notegpt-sidepanel-investigation.md`
- `app/watch/layout.tsx` (new server layout to export metadata for the client
  /watch page)
- `docs/SESSION-NOTES-2026-04-18-seo-push.md` (this file)

**Edited:**
- `app/page.tsx` — landing page. Redesign markup (nav CTA copy, hero badge,
  new ticker strip between hero and demo). Footer got `/install` link added
  earlier in the session to un-orphan it from the crawl graph.
- `app/landing.css` — full Jason-calibrated palette redesign. Blue→TWiST
  orange primary, matte black with a single orange scanline, "EPISODE 001"
  broadcast ribbon on the origin box, squared corners, uppercase chyron
  section labels, new `.ticker` + `.ticker-track` styles.
- `app/install/page.tsx` — trimmed meta description to 150 chars, added HowTo
  + BreadcrumbList JSON-LD.
- `app/privacy/page.tsx` — added BreadcrumbList JSON-LD.
- `app/watch/page.tsx` — added dismissible CTA banner linking to CWS after
  the `#pg-extension-bridge` div.
- `marketing/CLAUDE-DESIGN-BRIEF.md` — token table palette refresh to match
  the shipping orange palette.

**Memory files (`.auto-memory/`):**
- Created `reference_cws_compliance_checklist.md`
- Created `feedback_guides_not_sheets.md`
- Updated `MEMORY.md` index with both new entries.

**Tasks / scheduled:** Five scheduled tasks created (see table above). Task
IDs #23 + #24 added this session to the Cowork task list.

---

## Design alignment — shipping palette vs. brief

The **shipping** palette in `app/landing.css` (as of 2026-04-18):

| Token | Hex | Role |
|---|---|---|
| `--pg-bg` | `#0a0a0a` | Matte black base |
| `--pg-bg-card` | `#141414` | Cards, origin ribbon |
| `--pg-bg-panel` | `#1a1a1a` | Dark sections |
| `--pg-text` | `#e5e5e5` | Body |
| `--pg-text-dim` | `#9a9a9a` | Caption |
| `--pg-accent` | `#ff5a1f` | **Primary — TWiST burnt orange. CTA, section labels, nav CTA, link color.** |
| `--pg-accent-hot` | `#ef4444` | Recording red. LIVE/ON-AIR, CTA hover, ticker dot. |
| `--pg-accent-soft` | `#f59e0b` | Amber. Inline code, secondary highlights. |

The design brief's token table was updated to match. **Persona colors
(blue/red/purple/amber per the brief's §Persona palette) are unchanged** and
are separate from the global palette — they're owned by the persona cards
and must not bleed into global styling.

---

## Open decisions — need Seth's call

1. **Blog infrastructure.** `marketing/content/2026-W2-vs-competitors.md`
   needs a blog route to live on. Options: (a) `app/blog/[slug]/page.tsx`
   with MDX, (b) static markdown pages mirrored to `/blog/*`, (c) use a
   headless CMS. No work done on this yet — the post is draft-only.
2. **CWS category decision.** Productivity (current) vs. Tools (NoteGPT) vs.
   Entertainment (Dmooji). Blocked on Task #10.
3. **Variant A vs Variant B** for the CWS short description. Blocked on
   Task #9's rank audit data.
4. **The side-panel one-liner.** Per the NoteGPT investigation, a one-liner
   about "Peanut Gallery uses Chrome's native Side Panel API — not a
   page-injected overlay" should be added to (a) the CWS detailed description
   and (b) `app/install/page.tsx` §Features. Not done yet — coupled to
   the next CWS listing update so we don't stack submissions.
5. **Week 6 vs Week 2 for the comparison post.** `SEO-PLAN.md` schedules it
   Week 6; this session shipped it as Week 2 per Seth's "all four in order"
   direction. If that shipping cadence stays, revise the SEO plan to match.

---

## Hard rules carried over — do not violate

- **peanut.gallery git lock protocol.** See `peanut.gallery/CLAUDE.md`.
  Prevention-first. If `.git/index.lock` appears, ONE `rm`, ONE `mv`,
  then escalate to Seth's terminal. No third method. Ever.
- **`/watch` is legacy.** Only tiny SEO tweaks allowed. No feature/refactor.
  See `.auto-memory/project_watch_page_is_legacy.md`.
- **User-provided copy stays verbatim.** Seth hands over marketing/commit
  text and expects verbatim insertion.
- **Confirm SEO property before acting.** `ai@manugames.com` owns multiple
  properties; always confirm `peanutgallery.live` is selected.
- **Don't stack CWS submissions.** See `.auto-memory/reference_cws_review_policy.md`.
- **CWS compliance checklist is the pre-ship gate.** Every CWS listing edit
  or schema.org feature claim runs through it first. Re-verify canonical
  Google URLs every 90 days.
- **Guides, not sheets.** Default to guides Claude executes end-to-end.
  Sheets require huge, proven value + proof Claude literally cannot do the
  work. See `.auto-memory/feedback_guides_not_sheets.md`.
- **No copyright reproduction.** Nothing in `marketing/content/` quotes
  competitor marketing copy verbatim beyond single short phrases in
  quotation marks.

---

## Quick-resume checklist for a fresh session

If a new Claude instance picks up tomorrow:

1. Read `peanut.gallery/CLAUDE.md` (git protocol — non-negotiable).
2. Read `.auto-memory/MEMORY.md` (13 active memory entries).
3. Read this file top-to-bottom.
4. Check the scheduled tasks list — anything due to fire? Anything stale?
5. Preflight: `ls .git/*.lock 2>/dev/null` — if anything is there, STOP and
   surface to Seth.
6. Surface Seth's manual queue at the top of the first response. Ask which
   item to pair on first.

---

*Written 2026-04-18 by the SEO-push session's Claude, just before the switch
to Claude Design. If items in Seth's manual queue are unchecked 48h from now,
nudge him.*
