# Week 1 checklist — SEO plan kickoff (2026-04-18 → 2026-04-25)

The full plan lives in [`marketing/SEO-PLAN.md`](SEO-PLAN.md) §4. This file is the operational handoff: what I produced in the sandbox, and what Seth needs to do at a keyboard.

---

## What I shipped this session (files now in the repo)

| File | Purpose |
|---|---|
| [`marketing/CLAUDE-DESIGN-BRIEF.md`](CLAUDE-DESIGN-BRIEF.md) | Paste-ready setup brief for the Claude Design project. Tokens, fonts, brand voice, asset priority list, frontier-design play, boundary clause. |
| [`marketing/CWS-SHORT-DESCRIPTION-VARIANTS.md`](CWS-SHORT-DESCRIPTION-VARIANTS.md) | 3 short-description variants (A keyword-max, B conversion, C trust) + reordered 20 keyword slots + sync steps when rotating. |
| [`marketing/WIKIDATA-ENTRY-DRAFT.md`](WIKIDATA-ENTRY-DRAFT.md) | Copy-paste draft for Wikidata submission: labels, descriptions, statements, references. Includes the Person-item decision (skip until TWiST mention). |
| [`marketing/P1-P2-RESEARCH-WORKSHEET.md`](P1-P2-RESEARCH-WORKSHEET.md) | Worksheet Seth fills in a live Chrome session — CWS category audit + per-query rank table. |
| [`app/layout.tsx`](../app/layout.tsx) | Added `Organization` and `Person` JSON-LD blocks with `@id` anchors, and wired `publisher` + `author` on the existing `SoftwareApplication` to reference those IDs. TypeScript clean. |

No design assets generated yet — that's Seth's Claude Design UI task. No CWS changes pushed — that's Seth's CWS Dashboard task. No Wikidata item created — that's Seth's Wikidata submission task.

---

## Seth's keyboard tasks (in priority order)

### 1. Claude Design setup — 20 min
- [ ] Open Claude Design (claude.ai → Design) and create project **"Peanut Gallery — brand kit + SEO asset factory"**.
- [ ] Paste the sections from `CLAUDE-DESIGN-BRIEF.md` into their matching fields (description, tokens, voice).
- [ ] Upload reference images per §"Reference images" in the brief (promo/ folder, og-image.png, icon128.png, plus late-night-TV references from memory).
- [ ] Generate the **8 Week-1 assets** (CWS screenshots 1-5, small promo tile, marquee promo tile, new OG card).
- [ ] Drop outputs into `marketing/promo/claude-design/2026-04/` with the sibling `.json` prompt files.

### 2. CWS category + keyword audit (P1 + P2) — 30 min
- [ ] Open `P1-P2-RESEARCH-WORKSHEET.md` in a split pane with Chrome Web Store.
- [ ] Confirm you're signed in to CWS Dev Dashboard with the account that owns the extension listing.
- [ ] Fill the tables top-to-bottom. Don't optimize for speed — we're measuring real rank positions.
- [ ] Make the Step 4 decision (variant + rationale) and paste into the worksheet.

### 3. Ship the chosen CWS short-description variant — 15 min
- [ ] Edit `extension/manifest.json` → update `description` field to the chosen variant (≤132 chars).
- [ ] Bump `manifest.json` version (e.g., `1.4.0 → 1.5.0` if v1.5 is about to ship, or `1.4.0 → 1.4.1` for metadata-only).
- [ ] Run `scripts/pack-extension.sh` to produce the zip.
- [ ] Upload to CWS dev dashboard. **Do not stack submissions** — only one review in flight (per memory).
- [ ] Update `marketing/CWS-SHORT-DESCRIPTION-VARIANTS.md` "Current" block with the variant name + date.
- [ ] Paste the new 5 screenshots + promo tiles from Task 1 into the CWS listing while you're in there.

### 4. Submit Wikidata entry — 15 min
- [ ] Open `WIKIDATA-ENTRY-DRAFT.md`.
- [ ] Step 1: search Wikidata first — confirm no existing item.
- [ ] Step 2-4: create the item, add statements, add at least one reference per statement.
- [ ] Paste the new item's `Q-number` into the draft's status tracker + into `app/layout.tsx` Organization `sameAs` array.
- [ ] Commit the `sameAs` update.

### 5. Measurement baseline — 10 min
- [ ] Google Search Console (`ai@manugames.com`): **confirm `peanutgallery.live` is the active property** (per memory rule), screenshot current Performance report (28-day impressions + clicks).
- [ ] Bing Webmaster Tools: same — confirm property, screenshot baseline.
- [ ] GA4: pull current week's sessions + install CTA click-through, export as CSV. Save to `marketing/baselines/2026-04-18-pre-seo.csv`.
- [ ] Drop a one-line note in `marketing/SEO-PLAN.md` §5 working notes: *"Baseline captured 2026-04-18. Variant X shipped. Next measurement 2026-05-02."*

### Optional if time permits (P18 entity audit tail)
- [ ] Screenshot a current Google SERP for `peanut gallery youtube extension` and `"peanut gallery" chrome`. Save to `marketing/baselines/`. Useful for showing Knowledge Panel appearance over time after Wikidata lands.

---

## What I'll do once Seth hands back control

After Seth completes tasks 1-5 and tells me, I'll:

1. Read the filled-in `P1-P2-RESEARCH-WORKSHEET.md` and rewrite the long description if the competitor pattern analysis suggests a different structure.
2. Commit the `app/layout.tsx` Wikidata `sameAs` update once the Q-number is in.
3. Draft Week 2 assets: persona pack landing pages (`/packs/howard`, `/packs/twist`) — Next.js 15 static pages using the brand tokens, seeded with the Claude Design pack covers.
4. Write the first long-form content piece (P10 in SEO-PLAN): *"How I built an AI writers' room for YouTube in 6 weeks"* — ~1,800 words, targets `AI writers room` + `build chrome extension` + TWiST mention.

---

## Git

Nothing from this session touches the extension build or the Railway deploy — it's markdown + JSON-LD. Safe to commit as a single "SEO Week 1 kickoff" commit. Recommended:

```bash
# From /sessions/practical-busy-pasteur/mnt/peanut.gallery
git add marketing/CLAUDE-DESIGN-BRIEF.md \
        marketing/CWS-SHORT-DESCRIPTION-VARIANTS.md \
        marketing/WIKIDATA-ENTRY-DRAFT.md \
        marketing/P1-P2-RESEARCH-WORKSHEET.md \
        marketing/WEEK-1-CHECKLIST.md \
        app/layout.tsx && \
  git commit -F /tmp/msg-seo-week-1.txt
```

Where `/tmp/msg-seo-week-1.txt` contains:

```
docs(seo): Week 1 SEO kickoff — Claude Design brief, CWS variants, Wikidata draft, Person+Organization JSON-LD

- marketing/CLAUDE-DESIGN-BRIEF.md: paste-ready project brief for Claude Design asset factory (tokens, voice, 16-asset priority list)
- marketing/CWS-SHORT-DESCRIPTION-VARIANTS.md: 3 variants + reordered 20 keyword slots + sync rules
- marketing/WIKIDATA-ENTRY-DRAFT.md: labels, descriptions, statements, references for Seth's submission
- marketing/P1-P2-RESEARCH-WORKSHEET.md: rank audit worksheet for live Chrome session
- marketing/WEEK-1-CHECKLIST.md: this file — operational handoff
- app/layout.tsx: Organization + Person JSON-LD with @id anchors; publisher + author wired on SoftwareApplication
```

Per CLAUDE.md rules: single Bash call, `-F /tmp/msg...` file, explicit paths, `timeout: 300000`. Let me know when to run it.
