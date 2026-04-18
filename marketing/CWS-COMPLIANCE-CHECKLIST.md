# Chrome Web Store compliance checklist

**Purpose:** Standing rules sheet. Run every CWS listing edit, every website marketing claim, and every schema.org feature claim through this checklist before publishing. One violation → listing rejection or takedown. The $5 developer fee + weeks of review queue position are on the line.

**Last reviewed against Google policies:** 2026-04-18. CWS policies update quarterly; re-verify every 90 days or when Google announces a policy change.

**Canonical sources (read in full, don't paraphrase from memory):**
- Chrome Web Store Program Policies: https://developer.chrome.com/docs/webstore/program-policies
- User Data Policy: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
- Deceptive Installation / Behavior: https://developer.chrome.com/docs/webstore/program-policies/deceptive-installation-tactics
- Spam and Placement: https://developer.chrome.com/docs/webstore/program-policies/spam
- Manifest V3 requirements: https://developer.chrome.com/docs/extensions/develop/migrate
- Review process: https://developer.chrome.com/docs/webstore/review-process

---

## Quick-vet gate (run this before any edit to the CWS listing or the website's marketing claims)

For every change, answer yes/no to each:

- [ ] **Claim accuracy.** Every feature claim matches the shipping code (no "coming soon" framed as shipping).
- [ ] **Permission parity.** No new permission claim exceeds what `extension/manifest.json` actually declares.
- [ ] **Persona branding safety.** All persona names use "inspired by" framing, never "is" or "the official X." Trademarked names (Howard Stern, Baba Booey, etc.) never appear in the CWS *name* or *short description* field.
- [ ] **No keyword stuffing.** The name, short description, and category fields don't list unrelated keywords or repeat the same keyword more than needed for meaning.
- [ ] **Same-content-same-language.** If we edit EN copy, any other locale listing (currently: none) stays consistent.
- [ ] **No deceptive install claims.** Nothing says "official," "verified by Google," "featured," or implies endorsement we don't have.
- [ ] **Privacy disclosure parity.** If we add a data-handling claim in marketing, the privacy policy and CWS "Privacy practices" tab match.
- [ ] **Minor-safety check.** Nothing in the listing would place it in the "Directed to children" bucket (we don't target minors; keep it that way).

If any line is "no" → do not ship. Fix first.

---

## Section A — Extension itself (manifest, code, permissions)

### A1. Manifest V3 is mandatory

MV2 has been unsupported since June 2024. Confirm:
- [ ] `manifest.json` has `"manifest_version": 3`.
- [ ] No remote code execution (no `eval`, no loading `<script src="remote">`, no dynamic `Function()`).
- [ ] `content_security_policy` is either omitted or uses the V3 object form.
- [ ] Service worker replaces the old background page.

### A2. Minimum-necessary permissions

Any permission must be justified in the "Permission justification" field of the CWS listing. Audit:

- [ ] Every permission in `manifest.json` maps to a shipped feature. Remove unused ones before review.
- [ ] `host_permissions` are as narrow as possible. Broad `<all_urls>` requires strong justification.
- [ ] `tabCapture`, `sidePanel`, `storage` — our core permissions — each have a one-sentence justification.
- [ ] No `webRequest` / `webRequestBlocking` unless justified (we don't currently use these).
- [ ] No `management` permission unless the extension truly needs to list/modify other extensions (we don't).
- [ ] No `cookies` permission unless the extension reads cookies (we don't).

### A3. User data handling (this is the fastest path to rejection if wrong)

- [ ] We collect audio only after explicit user action (click "Start Listening").
- [ ] We collect API keys only from user input fields in our own UI.
- [ ] We don't log, persist, or transmit user data to any server not listed in the privacy policy.
- [ ] "Privacy practices" tab in the CWS dashboard is completed and matches `app/privacy/page.tsx`.
- [ ] "Single purpose" statement is accurate (our single purpose: add live AI reactions to YouTube videos).

### A4. Code-quality policies

- [ ] Source code is readable (no obfuscation beyond standard minification).
- [ ] No cryptocurrency mining.
- [ ] No affiliate-link injection.
- [ ] No ad injection on other sites.

---

## Section B — CWS listing metadata (where most footguns live)

### B1. Extension name

Per the CWS naming policy:
- [ ] Length 3–45 chars. (Ours: "Peanut Gallery" — 14 chars. ✅)
- [ ] Does not include irrelevant keywords ("best," "free," "#1," etc.).
- [ ] Does not imply endorsement ("Official Google," "Chrome-certified," "Anthropic Approved").
- [ ] Does not use trademarks we don't own as standalone terms (✅ — we don't).
- [ ] Does not include version numbers, dates, or promotional language.

### B2. Short description (≤132 chars)

The highest-leverage copy field. Check every variant:
- [ ] Under 132 chars (hard limit; longer is silently truncated in some surfaces).
- [ ] No ALL CAPS except for product names or acronyms.
- [ ] No emoji spam (at most one emoji OK; we use none).
- [ ] No special-character spam (no "⭐⭐⭐⭐⭐", no "♥♥♥").
- [ ] No keyword stuffing — each word must be part of a readable sentence.
- [ ] Accurate. If we say "live fact-checking," the code must actually fact-check live.
- [ ] No "Top rated," "#1," "Best" claims.

### B3. Detailed description (≤16,000 chars)

- [ ] Starts with a clear value proposition, not a keyword list.
- [ ] Uses the same language throughout (we're en-US only for now).
- [ ] Does not attempt to manipulate Chrome Web Store search by repeating unrelated categories.
- [ ] Mentions permissions explicitly and why they're needed (reviewer time-saver).
- [ ] Links to privacy policy (`peanutgallery.live/privacy`).
- [ ] Links to source code (`github.com/Sethmr/peanut.gallery`) — reinforces the "open source" claim.
- [ ] Does not promise features that require external services without disclosing the dependency.

### B4. Screenshots (1280×800 or 640×400, up to 5)

- [ ] Each screenshot reflects actual UI (no mockups that deviate from shipping product).
- [ ] No copyrighted video content visible that we don't have rights to show. If a screenshot shows a TWiST YouTube video playing, the fair-use claim is "functional demo of a Chrome extension overlaying YouTube's public interface" — that's reasonable but borderline; prefer a generic YouTube video (own content, CC, or a public livestream with clearly de-identified framing) when possible.
- [ ] No screenshots with inflammatory, political, or adult content visible in the background.
- [ ] No misleading UI annotations (don't label a non-existent button).
- [ ] Trademarks visible in screenshots (YouTube logo, Chrome logo) used in descriptive / nominative fair-use context only.

### B5. Promotional images (440×280 small tile, 1400×560 large marquee)

- [ ] Small tile (440×280) required. Includes the Peanut Gallery logo, no claim text that expires (e.g., "New!"), no prices or "free" overlays that conflict with the CWS pricing surface.
- [ ] Marquee (1400×560) optional. If used: same rules.
- [ ] Promotional tiles do not show the Chrome logo in a way that implies endorsement.

### B6. Category and tags

- [ ] Single primary category that most accurately describes the extension's core function. (Currently: Productivity. Testing: Tools. Decision pending P1 worksheet.)
- [ ] Tags (if enabled in the listing form) are relevant — no "amazon," "gmail," "porn" style keyword baiting.

### B7. Developer identity

- [ ] Developer name matches the registered Google account publisher profile.
- [ ] Developer contact email on the listing works (`ai@manugames.com` or whatever we've set).
- [ ] Registered publisher address is valid.

---

## Section C — Deceptive behavior policies (rejection territory)

### C1. No misleading claims

- [ ] Never say "verified," "approved by Google," "Chrome-partnered," or similar unless literally true.
- [ ] Never imply affiliation with Anthropic, xAI, Deepgram, Google, YouTube, or TWiST unless we have documented permission.
- [ ] Never include "Howard Stern," "Baba Booey," "Robin Quivers," "Fred Norris," "Jackie Martling" in the extension name, short description, or as primary positioning outside clearly labeled "inspired by" framing in the detailed description.
- [ ] Never include "Jason Calacanis," "Molly Wood," "Lon Harris," "Alex Wilhelm" in the extension name or short description. Detailed description may reference "This Week in Startups" with attribution as inspiration, not endorsement.

### C2. No forced installs / install tricks

- [ ] The CWS install flow is the only sanctioned install path.
- [ ] We never instruct users to sideload unless they are explicitly choosing the self-host path.
- [ ] We never bundle this extension with another install.

### C3. No keyword stuffing in search-visible fields

"Keyword stuffing" = listing unrelated keywords or repeating the same keyword to game search. The CWS spam policy is strict.

Bad (would be flagged):
> "AI YouTube extension ChatGPT Claude GPT GPT-4 GPT-5 Gemini Bard AI chat AI tool"

Good (what we're doing):
> "AI sidebar for YouTube. 4 personas react live in Chrome's side panel — fact-checker, troll, comedy writer, sound guy. Free."

### C4. Promotional-content rules

- [ ] No "Install now for 50% off" — we don't have pricing tiers to offer.
- [ ] No contests / giveaways run through the listing.
- [ ] Reviews: we don't solicit reviews in-extension; if we do later, we follow the CWS guidelines (no gating features behind reviews, no incentivizing reviews).

---

## Section D — IP, trademarks, and fair use

### D1. Third-party brand use

Our persona names reference real people and media properties. CWS and Google's trademark policy requires:

- [ ] Nominative fair use only: we reference names to describe *inspiration*, not to imply *origin*.
- [ ] No logos of Howard Stern Show, SiriusXM, TWiST, or Jason Calacanis's personal brand on the CWS listing or promotional artwork unless we have written permission.
- [ ] Persona descriptions in the detailed description always frame as "inspired by" and credit the source material when relevant.
- [ ] If any of the living persona namesakes (Jason Calacanis, Molly Wood, Lon Harris, Alex Wilhelm) sends a takedown request, we rename that persona within 48 hours — a "living reference" framework is in place in `.auto-memory`.

### D2. YouTube / Chrome branding

- [ ] We describe the product as a "Chrome extension" — allowed. We don't use "Chrome" or "Chrome browser" in the name.
- [ ] We describe the product as working on "YouTube" — allowed (nominative). We don't use a YouTube logo except in functional UI screenshots.
- [ ] We never imply YouTube or Chrome endorses, partners with, or hosts the extension.

### D3. AI provider branding

- [ ] Anthropic, xAI, Deepgram, Brave — named in descriptive context (what the extension uses), not in endorsement context.
- [ ] Their logos only in technical documentation / schema.org feature lists, not as CWS promotional artwork.

---

## Section E — Pre-publish checklist (run this immediately before hitting "Submit for review")

Single-pass final check:

1. [ ] Read the proposed change once slowly. If a single sentence sounds like a marketing exaggeration, rewrite it to something that's literally true and would survive a journalist fact-check.
2. [ ] Open the current live CWS listing in one tab. Diff it mentally against the proposed change. Any new claim? Any removed claim? Does the new claim need a justification in the permission rationale?
3. [ ] Open `app/privacy/page.tsx` in another tab. If we're adding a data-handling claim in the listing, it must be reflected in the privacy policy before we submit.
4. [ ] Open `extension/manifest.json`. If the listing mentions a capability, confirm the corresponding permission exists or we know why it doesn't.
5. [ ] Open this checklist. Walk through the quick-vet gate and Section B one more time.
6. [ ] If a submission will require a re-review (permission addition, new host permission, new disclosed data type), budget **5–10 business days** and do not stack new changes on top of a pending review. Per `.auto-memory/reference_cws_review_policy.md`: never stack CWS submissions.

If all six are green, ship it. Otherwise, fix or hold.

---

## Section F — Website / landing page rules

The peanutgallery.live site isn't subject to CWS review directly, but any claim on the website that contradicts the CWS listing creates a deceptive-marketing risk and can be used against the CWS listing during review or takedown requests.

- [ ] Website feature claims mirror the CWS detailed description.
- [ ] Website pricing claims ("free") match the CWS offer ($0).
- [ ] Website does not claim "official" / "verified" / "endorsed" status.
- [ ] Privacy policy on the website matches the CWS "Privacy practices" tab.
- [ ] Schema.org `SoftwareApplication` `featureList` matches the CWS detailed description's feature bullet list.
- [ ] Any persona names in website copy follow the same "inspired by" rule as the CWS detailed description.

---

## Section G — Specific risk register for Peanut Gallery

High-risk items that deserve ongoing monitoring:

| Risk | Severity | Mitigation |
|---|---|---|
| Living-person persona names (Calacanis, Wood, Harris, Wilhelm) | High | "Inspired by" framing everywhere; 48h rename SLA on takedown request |
| Deceased / retired person persona names (Stern crew) | Medium | "Inspired by" framing; estate-aware when a name corresponds to a living estate (Baba Booey is alive — same rule) |
| YouTube terms of service | Medium | We use `chrome.tabCapture` (user-consented), not scraping. Reviewed against YouTube's TOS §I.A and §III.A. |
| "Free" claim | Low | Truly free. No pricing tier exists. |
| Side Panel API stability | Low | NoteGPT removed it — investigate before next update |
| Schema.org `AggregateRating` absence | Low (positive) | We don't claim ratings we don't have |

Rev this table as new risks surface.

---

## How to use this checklist

- Before any CWS listing edit: walk sections A, B, C, E.
- Before any marketing-copy change on peanutgallery.live that makes a product claim: walk section F + the quick-vet gate.
- Before submitting to review: walk section E end-to-end.
- On any Google policy update alert: re-read the relevant canonical source and revise this file.

If I (Claude) am about to ship a change that touches the CWS listing or a marketing claim and haven't re-read this file in the current session, I stop and re-read it first.
