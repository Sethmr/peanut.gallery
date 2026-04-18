# Wikidata entry draft — Peanut Gallery

Wikidata is the structured-data backbone Google reads for Knowledge Panels and rich results. Landing a clean Wikidata item for Peanut Gallery — with solid references — is the single cheapest entity-optimization move we have (SEO‑PLAN §3 Part C, P18).

**Submit from Seth's account**, not `ai@manugames.com`. Wikidata volunteers flag edits made by freshly created accounts editing a single item; submit from an account with non-trivial history (or make a few unrelated edits first to avoid the new-user filter).

---

## Step 1 — Search before creating

Before anything else, go to https://www.wikidata.org/wiki/Special:Search and search for:

- "Peanut Gallery"
- "peanutgallery.live"

If an item already exists, **update it** rather than creating a duplicate. Duplicates are hard to merge later and waste moderator attention.

Assuming none exists, continue to Step 2.

---

## Step 2 — Create the item

Go to https://www.wikidata.org/wiki/Special:NewItem

### Labels (per language)

| Lang | Label |
|---|---|
| en | Peanut Gallery |
| en-us | Peanut Gallery |

### Descriptions (per language)

| Lang | Description |
|---|---|
| en | free and open-source Chrome extension that adds four AI personas to any YouTube video |
| en-us | free and open-source Chrome extension that adds four AI personas to any YouTube video |

Keep it short and generic — Wikidata descriptions are for disambiguation, not marketing. "Chrome extension" + "AI" is enough to distinguish from every other "Peanut Gallery" meaning (there are many — the idiom, the 1948 film, etc.).

### Aliases (all languages, English unless noted)

- Peanut Gallery (Chrome extension)
- peanutgallery.live
- Peanut Gallery extension

---

## Step 3 — Statements (add in this order)

Wikidata statements are `property → value`. Click "add statement" and type the property name; auto-complete will surface it.

### Core identity

| Property | Value | Notes |
|---|---|---|
| **instance of** (P31) | browser extension (Q8467175) | |
| **instance of** (P31) | free and open-source software (Q506883) | Add as a second P31 value |
| **developer** (P178) | Seth Rininger | Will need a Person item for Seth. If none exists, leave this blank for now and add after Step 5. |
| **programmed in** (P277) | TypeScript (Q978185) | |
| **programmed in** (P277) | JavaScript (Q2005) | |
| **operating system** (P306) | Google Chrome (Q777) | |
| **license** (P275) | MIT License (Q334661) | |
| **copyright license** (P275) | MIT License (Q334661) | Duplicate of above — only needed if the interface prompts for copyright specifically |
| **source code repository URL** (P1324) | `https://github.com/Sethmr/peanut.gallery` | |
| **official website** (P856) | `https://peanutgallery.live` | |
| **logo image** (P154) | Upload `icon-512.png` to Wikimedia Commons first, then reference here | Optional for v1; can add later. |

### Platform / ecosystem

| Property | Value | Notes |
|---|---|---|
| **platform** (P400) | Google Chrome (Q777) | |
| **inception** (P571) | 2026-04 | Approximate month of first Chrome Web Store publication |
| **genre** (P136) | productivity software (Q388277) | |

### External identifiers (critical for Knowledge Panel linkage)

| Property | Value | Notes |
|---|---|---|
| **Chrome Web Store extension ID** (P8002, if available — otherwise use `full work available at URL` P953) | `jjlpinlhfiheegiddmddkgfialcknagh` | If P8002 doesn't resolve in the UI, skip — CWS IDs aren't always in Wikidata's schema. |
| **GitHub username** — use on *Seth's* Person item, not this one | `Sethmr` | |

---

## Step 4 — References (add at least ONE reference to every statement)

Wikidata statements without references get quietly deprioritized. Add references by clicking the "+" under each statement and choosing **"stated in"** or **"reference URL"**.

**Recommended reference URLs** (reuse across statements):

1. `https://chromewebstore.google.com/detail/peanut-gallery/jjlpinlhfiheegiddmddkgfialcknagh`
   - Retrieved: today's date
   - Supports: official website, developer name, inception, operating system, license claim ("Free").
2. `https://github.com/Sethmr/peanut.gallery/blob/main/LICENSE`
   - Supports: MIT License (P275).
3. `https://github.com/Sethmr/peanut.gallery`
   - Supports: programmed in (inferred from repo language stats), source code repo URL, developer.
4. `https://peanutgallery.live`
   - Supports: official website (trivial self-reference is OK here).

Paste each as **reference URL** (P854), with **retrieved** (P813) set to today's date.

---

## Step 5 — Create Seth's Person item (if missing)

If a Wikidata item for Seth doesn't exist, creating one is worth it *only if* there's at least one external source that discusses him. Candidates:

- Jason Calacanis / Lon Harris mentioning him by name on a TWiST episode (if that happens).
- A published article or podcast interview.
- A high-signal GitHub profile is **not enough** on its own for Wikidata notability.

**Recommendation:** skip the Person item until after the TWiST mention or a first press hit. Until then, leave the `developer (P178)` field on the Peanut Gallery item as a plain text value ("Seth Rininger") rather than a linked item, and revisit in ~30 days.

If we do create it later, the draft schema for Seth's Person item:

| Property | Value |
|---|---|
| instance of (P31) | human (Q5) |
| sex or gender (P21) | male (Q6581097) |
| occupation (P106) | software engineer (Q82594) |
| occupation (P106) | software developer (Q5482740) |
| employer | (whatever Seth's current day-job is, if public) |
| notable work (P800) | Peanut Gallery (→ link back to the item we just created) |
| website (P856) | `https://sethrininger.dev` |
| GitHub username (P2037) | `Sethmr` |
| X username (P2002) | `SethRininger` |

---

## Step 6 — After submission (within 24 hours)

1. Copy the Wikidata item ID (looks like `Q123456789`).
2. Add it to `app/layout.tsx` → Organization JSON-LD `sameAs` array:
   ```
   "https://www.wikidata.org/wiki/Q123456789"
   ```
3. Paste the ID into this file's header in place of the TODO marker below.
4. Check Google Search Console → Enhancements → Sitelinks searchbox for any entity-related surface changes over 2–4 weeks.

---

## Status tracker

- **Wikidata item ID:** `TODO — paste after submission`
- **Submitted on:** `TODO`
- **Submitted by:** Seth Rininger (personal account)
- **Next review:** 30 days post-submission — check if statements are disputed, confirm references held up, add Person item if TWiST mention has happened by then.
