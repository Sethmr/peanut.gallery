# CWS short description — A/B variants + keyword slot recommendations

The Chrome Web Store short description (also surfaced as the summary under the extension name in search results) is the single highest-leverage SEO field in the CWS. Limit: **132 characters**.

This file holds three variants to rotate every 2 weeks during P2 (SEO‑PLAN §3 Part A), plus the 20 keyword slots to fill in the dev dashboard. When you change the short description, **mirror the change in `extension/manifest.json` `description`** — CWS pulls the summary from the manifest on upload, and they must agree.

---

## Current (shipped in v1.4.0 — baseline)

```
AI writers' room for YouTube. 4 personas react live — fact-checker, troll, sound guy, comedy writer. Howard or TWiST pack.
```
*122 chars.* Keyword-heavy on "AI writers' room" and persona names but **missing the primary commercial-intent query "YouTube AI sidebar" and the phrase "Chrome side panel" that matches CWS search behavior.**

---

## Variant A — Keyword-max (ship this as v1.5.0's short description)

```
AI sidebar for YouTube. 4 personas react live in Chrome's side panel — fact-checker, troll, comedy writer, sound guy. Free.
```
*123 chars.* Surfaces `YouTube AI sidebar`, `Chrome side panel`, `react live`, `free`. Drops "Howard/TWiST pack" (too insider for first-touch) and "writers' room" (compressed into "4 personas"). Best for cold CWS search discovery.

## Variant B — Conversion-focused

```
Watch YouTube with 4 AI personas — live fact-checker, troll, comedy writer, sound guy. Free Chrome extension. No sign-up.
```
*121 chars.* Starts with the user action ("Watch YouTube with..."), ends with "No sign-up" which crushes install-page bounce. Surfaces `AI personas`, `fact-checker`, `Chrome extension`. **Run this one during Product Hunt / TWiST-episode launch weeks** — the "no sign-up" close earns the click when traffic is warm.

## Variant C — Trust/authority

```
Free, open-source Chrome extension. 4 AI personas react to YouTube live — fact-checker, troll, comedy writer, sound guy.
```
*121 chars.* Leads with `Free, open-source` — both power words for devs browsing CWS. Surfaces `open source`, `Chrome extension`, `react to YouTube live`. Best for developer audiences (HN, Reddit /r/programming, dev Twitter).

---

## Rotation plan

| Week | Variant | Why |
|---|---|---|
| W1–W2 | **A (Keyword-max)** | Build organic CWS search surface. Default for cold discovery. |
| W3–W4 | **B (Conversion)** | Product Hunt / TWiST mention push — warm traffic, optimize for install rate. |
| W5+ | **Winner of A/B on install rate** | Pick the variant with higher install‑per‑impression from CWS analytics → then re-test against Variant C. |

Measure from **CWS Developer Dashboard → Statistics → Impressions / Installs per day**, not from GA. CWS search is the traffic we're optimizing.

---

## Sync steps when rotating

1. Edit the chosen variant into `extension/manifest.json` `description` (keep char count ≤132).
2. Bump `extension/manifest.json` `version` (e.g., 1.5.0 → 1.5.1) — CWS requires a version bump for *any* listing change, even metadata.
3. Run `npm run pack:extension` (see `scripts/pack-extension.sh`).
4. Upload to CWS via Developer Dashboard — **do not stack submissions** (per CWS review policy in memory; only one review in flight at a time).
5. Update this file's "Current" section with the new live variant + date.

---

## Search-term slots (20 slots, fill ALL in CWS dev dashboard)

Reordered from the baseline in `marketing/cws-listing.md` — priority slots first, since slot position influences CWS internal ranking:

| # | Slot | Category | Intent |
|---|---|---|---|
| 1 | youtube ai sidebar | primary | commercial |
| 2 | ai sidebar youtube | primary variant | commercial |
| 3 | chrome side panel extension | primary | commercial |
| 4 | youtube chrome extension | primary | navigational |
| 5 | youtube fact checker | primary | commercial |
| 6 | ai commentary youtube | primary | informational |
| 7 | ai reacts to youtube | primary | informational |
| 8 | real-time ai commentary | long-tail | commercial |
| 9 | live youtube transcription | long-tail | commercial |
| 10 | ai writers room | branded concept | informational |
| 11 | youtube ai assistant | long-tail | commercial |
| 12 | ai booth producer | positioning | informational |
| 13 | podcast ai companion | vertical | commercial |
| 14 | podcast fact checker | vertical | commercial |
| 15 | youtube ai reactions | long-tail | informational |
| 16 | open source chrome extension | qualifier | commercial |
| 17 | howard stern ai | brand-adjacent | informational |
| 18 | this week in startups | brand-adjacent | navigational |
| 19 | jason calacanis | brand-adjacent | navigational |
| 20 | twist pack | branded SKU | navigational |

**Dropped** from the old baseline: `startup podcast extension` (too narrow and overlaps 13), `youtube ai commentary` (duplicate of 6 singular/plural — CWS dedupes them).

**On Jason/TWiST slots**: keeping 17-20 because they index for brand-adjacent search (e.g., a *TWiST* viewer Googling "jason calacanis chrome extension"). If Jason ever plugs the product publicly, slots 18-19 are pre-warmed.

---

## Variant D — parking lot (not recommended for W1)

```
AI booth producer for YouTube podcasts. 4 personas — fact-check, roast, sound FX, jokes. Live, free, open-source Chrome.
```
*120 chars.* Tested internally: "booth producer" is our positioning differentiator but has near-zero CWS search volume. **Use this variant only in blog headlines and X posts, not in CWS.** The phrase is too novel to rank.
