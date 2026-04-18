# P1 + P2 research worksheet — Chrome Web Store audit

For use during a live Chrome session with `ai@manugames.com` logged in. Two prompts in play:

- **P1 — Category + positioning audit.** What category are we in? What are the top extensions in that category and what do they do that we don't?
- **P2 — Keyword slot + short-description optimization.** Which slots are we wasting? Which are the top-ranking extensions using that we're not?

Both should be completed in one sitting — ~30 minutes. Fill in the tables below as you go; leave the notes column terse (one phrase).

---

## P1 — Category + positioning audit

### Step 1: current CWS listing state

- [ ] **Our listing URL:** https://chromewebstore.google.com/detail/peanut-gallery/jjlpinlhfiheegiddmddkgfialcknagh
- [ ] **Current category:** Productivity (per `marketing/cws-listing.md`)
- [ ] **Current # of installs:** ______
- [ ] **Current rating + # of ratings:** ______ / 5 from ______ ratings
- [ ] **Current weekly active users:** ______

### Step 2: top 10 extensions in our current category

Search CWS → Productivity → sort by "Relevance" and "Best of" tabs. Fill top 10 for each:

#### Relevance tab (Productivity)

| # | Extension name | Install count | What it does (5 words) | Note |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |
| 8 | | | | |
| 9 | | | | |
| 10 | | | | |

#### "Best of" tab (Productivity)

| # | Extension name | Install count | What it does (5 words) | Note |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

### Step 3: test alternate category fit

Each test: type the query into CWS search, scroll until you find our extension (or don't). Mark position.

| Category | Our listing rank | Rank of top competitor in this cat. | Verdict |
|---|---|---|---|
| Productivity (current) | | | |
| Entertainment | | | |
| Developer Tools | | | |
| Social & Communication | | | |
| Accessibility | | | |

### Step 4: P1 decision

**Stay in Productivity** if we rank in the top 30 for our 3 primary queries (`youtube ai`, `ai sidebar`, `youtube ai extension`). **Move to Entertainment** if we rank >50 *and* top Entertainment competitors have 10× fewer installs than top Productivity competitors.

Decision: ____________________
Rationale: ____________________

---

## P2 — Keyword slot + short-description optimization

### Step 1: our current rank on the 20 target queries

For each query, search CWS, scroll until you find our extension or hit page 3. Log the position.

| # | Query | Our rank | Top result | Top result's short description (copy verbatim) |
|---|---|---|---|---|
| 1 | youtube ai sidebar | | | |
| 2 | ai sidebar youtube | | | |
| 3 | chrome side panel extension | | | |
| 4 | youtube chrome extension | | | |
| 5 | youtube fact checker | | | |
| 6 | ai commentary youtube | | | |
| 7 | ai reacts to youtube | | | |
| 8 | real-time ai commentary | | | |
| 9 | live youtube transcription | | | |
| 10 | ai writers room | | | |
| 11 | youtube ai assistant | | | |
| 12 | ai booth producer | | | |
| 13 | podcast ai companion | | | |
| 14 | podcast fact checker | | | |
| 15 | youtube ai reactions | | | |
| 16 | open source chrome extension | | | |
| 17 | howard stern ai | | | |
| 18 | this week in startups | | | |
| 19 | jason calacanis | | | |
| 20 | twist pack | | | |

**Rank legend:** `1-10` strong / `11-30` needs push / `31-60` weak / `>60 or not found` dead.

### Step 2: identify top-3 "dead" queries for the winning variant

After filling the table, pick the three queries where:
- We rank >60 AND
- The top 3 competitors are all clearly using the phrase in their short description.

Those are where Variant A (keyword-max) earns its spot.

Top-3 dead queries:
1. ____________________
2. ____________________
3. ____________________

### Step 3: competitor short-description patterns

Note any patterns in the #1-ranked extensions' short descriptions:
- [ ] Start with a verb? ("Block…", "Translate…", "Capture…")
- [ ] Start with a noun phrase? ("The fastest…", "An AI…")
- [ ] Lead with free? ("Free…")
- [ ] Use emoji? (⚡️, 🎯, 🎬)
- [ ] Use em-dash or comma-separated list? 
- [ ] Use "for [niche]"? ("for YouTube", "for Zoom")

Pattern summary: ____________________

### Step 4: P2 decision — which variant to ship

Based on Step 2 + Step 3:
- [ ] Variant A (keyword-max) — ship if we have ≥3 dead primary queries
- [ ] Variant B (conversion) — ship if top competitors all use CTA-style short descriptions
- [ ] Variant C (trust/authority) — ship if top 3 in our category all lead with "Free" or "Open-source"
- [ ] Keep current — ship only if we already rank top-30 on ≥10 of 20 queries

Ship: Variant ____________________
Rationale: ____________________

---

## Post-session actions

After filling this worksheet:

1. Paste the chosen variant into `extension/manifest.json` `description` (keep ≤132 chars).
2. Bump `manifest.json` version (patch bump is fine for a metadata-only change).
3. Run `scripts/pack-extension.sh`.
4. Upload to CWS via Developer Dashboard (single submission, no stacking).
5. Note the submission date + variant in `marketing/CWS-SHORT-DESCRIPTION-VARIANTS.md` "Current" section.
6. Schedule a 14-day re-measurement — repeat this worksheet and compare rank deltas.
