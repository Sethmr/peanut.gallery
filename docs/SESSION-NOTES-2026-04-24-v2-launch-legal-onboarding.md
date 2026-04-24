# Session notes — 2026-04-24 · v2.0 legal pass + v2.0.1 WIP + onboarding spec

**Status summary.** v2.0.0 "The Gallery" is staged on `origin/develop` with a
ready-to-upload CWS zip at `releases/peanut-gallery-v2.0.0.zip`. **Zip is on
hold pending v2.0.1 batch** (detailed below). Lawyer brief landed mid-session
at `legal-research/BRIEF-2026-04-24.md` — Manu Games LLC single-member NC,
single-member scope, deployable research not legal advice. This session
incorporated the brief's mechanical findings, rewrote ToS + Privacy, patched
two code-level compliance gaps, and scoped the onboarding-wizard product
direction Seth wants next.

**What to read first in the next session.** This document, then
`legal-research/BRIEF-2026-04-24.md`, then `docs/FACT-CHECK-LAYER.md`. Start
with "Open decisions" and "Onboarding wizard spec" below — those are the
action items that drive the next session.

---

## Release state

| Manifest | Location | CWS? |
|---|---|---|
| `v1.5.3` "The Cast" | last wide CWS rollout (2026-04-20) | live |
| `v1.8.0` "The Press Pass" | `develop` + Railway (2026-04-22), absorbed v1.6 + v1.7 | no |
| **`v2.0.0` "The Gallery"** | `develop` (2026-04-23), zip packed | **pending v2.0.1 finalize** |
| `v2.0.1` "The Gallery — compliance pass" | WIP, two patches committed on `develop`, more queued | pending |

`main` is still at v1.5.3. The plan is for v2.0.1 to be the first CWS
release that reopens `main` after the long develop-only accumulation.

### Commits landed this session

**`chrome-extension/develop`:**
```
3407fb2 fix(v2.0.1): SUBSCRIPTION_CAP_REACHED UX + Deepgram mip_opt_out=true
81aa3f8 release(v2.0.0): The Gallery — CWS launch manifest bump
b927393 chore: fix stale email on legacy /privacy Next.js route + third cerebras coerce
d1f7a41 feat(personas): "inspired by" legal hedge — persona.inspiredBy field + prepended PARODY FRAME
ce60a5c feat(sidepanel): add "Feedback & bugs" section to settings drawer
0277fc6 docs: audit sweep — reconcile persona-layer docs with fact-check-layer reality
f0e2874 feat(molly): apply fact-check layer — NPR-journalist voice + CONFIRMS/CONTRADICTS/COMPLICATES/THIN taxonomy
32a4d8e feat(baba): fact-check layer applied — trolly voice + CONFIRMS/CONTRADICTS/COMPLICATES/THIN taxonomy
e96d3c6 fix(director-v3): silence cerebras schema-dump log spam + recover stringified confidence
3babdc4 feat(sidepanel+sfx): mute-sfx toggle, Jackie↔Jason cue swap, trim Fred+Lon, bowling-pin cue for Jason
```

**`site/main`:**
```
502b734 legal: post-lawyer-brief rewrite — Manu Games LLC entity, Plus deferred, AI-training/DMCA/export sections
dab3d9c legal: mechanical fixes to cross-doc links (pre-lawyer-brief audit)
391321d seo: backfill Twitter card + og:image dimensions on /terms/ and /privacy/
eefe40c site: bump to v2.0.0 "The Gallery" — JSON-LD + Howard pack stamp
eed855e pricing: add "Are these the real people?" FAQ + JSON-LD entry
```

### Uncommitted changes on `develop` at session-end

```
M extension/sidepanel.js   ← Plus-tab-shows-popup patch (see below)
```

The Plus-tab popup is staged + syntax-checked but not committed. It replaces
what would have been the capability-probe approach. On Plus click, the
existing `openPromptModal({ hideInput: true })` helper shows a modal stamped
"Coming soon" with the body text about provider-approval and compliance work.
The segmented control does not switch to Plus; prior mode sticks. Also
includes a load-time degradation: persisted `pgBackendMode: "plus"` from a
pre-v2.0.1 install silently coerces to `"demo"` so no one boots into a dead
Plus state.

**This patch belongs in the v2.0.1 batch** — don't orphan it.

---

## Legal brief consumption

`legal-research/BRIEF-2026-04-24.md` (882 lines) arrived mid-session. Three
hard constraints from its Executive Summary:

1. **Anthropic §D.4 + Deepgram §2.3(c) prohibit resale by default.** xAI §1.2
   expressly permits Bundled Services. Brave §3(b)(xii) prohibits
   redistribute/resell (server-side-derived-commentary read is defensible).
   Bundled Plus architecture is a live contractual risk until written
   reseller approval or a pre-paid BYOK-relay re-architecture.

2. **Section 230 will not shield AI persona output** post-*Anderson v.
   TikTok* (3d Cir. 2024) and *Garcia v. Character Technologies* (M.D. Fla.
   2025). Manu Games is the first-party speaker for every persona utterance.
   Anthropic §K indemnity runs to Customer (Manu Games) only, does not flow
   to subscribers.

3. **Right-of-publicity is the dominant non-contractual risk.** CA §3344 +
   AB 1836, TN ELVIS Act §47-25-1101 et seq., IL IRPA, IN extraterritorial.
   Jason Calacanis (CA) and Gary Dell'Abate (NY/CT) anchor forum exposure
   on two coasts. Soft-gates + synthesized-text-only (no voice clone) +
   parody framing + claim-allow/deny list are the minimum mitigations.

### Applied this session

- **Entity** on ToS + Privacy flipped to "Manu Games LLC, a North Carolina
  limited liability company." (Seth: confirm this is accurate. Previous ToS
  said "sole proprietor.")
- **Plus deferred** — ToS + Privacy note Plus is "planned, not currently
  offered." Plus UI code stays in the repo as OSS / forward-compat.
- **New ToS sections**: AI output and persona framing (text-only, no voice
  clone, no image likeness); Provider usage policies (flow-down of Anthropic,
  xAI, Deepgram, Brave AUPs); AI training on your content (non-training
  posture per provider with `mip_opt_out=true` claim); Export and sanctions
  (brief §9E verbatim); DMCA safe harbor (designated agent + § 512(c)(3)
  takedown process).
- **Privacy additions**: AI-training-data disclosure mirroring the ToS
  section; explicit BYOK-is-not-a-processor language; retention table trimmed
  of Plus-specific rows with a note they return at launch.
- **`mip_opt_out=true`** added to every Deepgram WebSocket request in
  `lib/transcription.ts`. Without this, Deepgram MSA §3.1 grants them a
  license to use Content for model training via MIPP. Our Privacy Policy
  claims "Audio streamed + discarded." `mip_opt_out=true` makes that true.
  Trade-off: forfeits the MIPP pricing discount (~2x per-minute cost).
- **SUBSCRIPTION_CAP_REACHED** + SUBSCRIPTION_INVALID_KEY + SUBSCRIPTION_DISABLED
  handlers in sidepanel.js. Clean drawer-reopening UX instead of raw
  error banner. Relevant again when Plus relaunches at v2.5+.
- **Inspired-by parody frame** (shipped earlier in the session, pre-brief).
  New `persona.inspiredBy` field; `buildPersonaContext` prepends a PARODY
  FRAME block that instructs the model to say "AI fan parody" if asked
  directly whether it's the real person. All 8 personas tagged.
  Methodology in `docs/FACT-CHECK-LAYER.md`.
- **Stale email** `seth@manugames.com` on the dead-code `app/privacy/page.tsx`
  Next.js route flipped to `legal@peanutgallery.live`.
- **Broken cross-doc links** on ToS + Privacy fixed
  (`SELF-HOST-FOR-INTERNATIONAL-USERS.md` → `SELF-HOST-INSTALL.md`,
  markdown fragment anchor → `/terms/#acceptable-use`).

### Not applied — waiting for Seth decisions, legal counsel review, or
deliberate product-direction calls

- **License**: MIT vs. Apache 2.0. Brief §9A recommends Apache 2.0 for AI
  projects (explicit §3 patent grant). Deferred until after v2.0 ship per
  Seth. Current state: MIT.
- **Merchant of Record**: Stripe direct vs. Lemon Squeezy / Paddle. Brief
  §6D recommends Lemon Squeezy (5% + $0.50 full MoR) once Plus is live.
  Per Seth: "If we can switch to lemon squeezy if we can mimic plus, but
  anything with plus should be v2.5+ now." Deferred.
- **Cookie-consent banner** (GDPR / ePrivacy). US-only gate reduces but
  doesn't eliminate EU traffic. Brief §7D: "at <1,000 US-only subscribers,
  IP-blocking is cleaner." Not implemented; low priority given US-only
  posture.
- **Formal arbitration clause** (JAMS or AAA). Current ToS has jury waiver
  + small-claims preservation + 60-day informal-resolution window, governed
  by NC law. Brief §7A recommends a full arbitration clause; current ToS
  does not have one. Deferred to counsel review.
- **Remove "Draft pending legal review" banners** — already done in the
  site rewrite; `Last updated` bumped to 2026-04-24.
- **"Draft pending legal review"** on the dead-code Next.js privacy page —
  not touched (that route is 308-redirected by middleware; cosmetic only).
  Worth deleting the whole `app/privacy/page.tsx` route in a future
  cleanup. Flag but not block.
- **Private-figure claim-detector block** (brief §12.8 red flag). Soft-gate
  exists in the v1.8 persona kernels per `DESIGN-PRINCIPLES.md § 3a`; a
  hardcoded block-list of private individuals does not. Design decision
  pending: allow-list vs. deny-list vs. pattern-based detector. Defer to a
  post-Jason-consent-outcome pass.

### Operational follow-ups — Seth's tasks, not code changes

- **Register DMCA agent** at [dmca.copyright.gov](https://dmca.copyright.gov),
  **$6 per 3-year period** (NOT $6/month — the brief was slightly off).
  Needs Seth's identity details; ~10 minutes.
- **Confirm `legal@peanutgallery.live` inbox is live** — ToS now points
  DMCA notices there. If not configured, set up or consolidate on a single
  inbox that is.
- **Confirm `Manu Games LLC` is the operating entity.** ToS + Privacy now
  name it. If Seth is still sole-prop pre-LLC-formation, flip one string
  in both docs.
- **USPTO `peanut gallery` search** in Classes 9 (software) + 42 (SaaS)
  at [tmsearch.uspto.gov](https://tmsearch.uspto.gov). JS-rendered SPA, must
  be done in a browser. Brief §10A. If clear: file 1(a) use-based in both
  classes within 30 days of first paid-subscriber (to anchor the first-use
  date). ~$700 DIY, ~$1,500 with flat-fee attorney.
- **Media-liability insurance quote** from your broker. Specifically ask
  about "AI output coverage" / "cyber + media liability rider." Standard
  CGL excludes AI-generated content.
- **Flip `ENABLE_SUBSCRIPTION=false` on Railway** before CWS upload. The
  backend subscription endpoints should be off. My recently-staged Plus-tab
  popup handles UI-side gating; the env flip handles backend-side.
- **Email Anthropic partnerships + Deepgram sales** about reseller approval
  — only relevant when Plus returns at v2.5+. Don't email yet if not
  relaunching soon. Warm conversations are easier with a named first
  customer (see "Jason consent path" below).

---

## v2.0.1 batch — pending work

Two commits already landed on `develop` (cap-reached UX + Deepgram
mip_opt_out). These remain:

1. **Plus-tab popup** — uncommitted patch in `extension/sidepanel.js`.
   Intercepts Plus click, shows `openPromptModal` with "Coming soon,
   working on legal compliance" message. Prior mode sticks. Persisted
   `plus` mode degrades to `demo` on load.

2. **Session-start AI-disclosure banner** (Anthropic AUP line 146, hard
   obligation). **NOT YET IMPLEMENTED.** Pending Seth's UX decision among:
   - **(a) Permanent AI badge in the masthead** — always-visible small
     "AI" tag next to the Peanut Gallery title.
   - **(b) Toast at session start** — appears for ~5s when Start Listening
     is clicked, dismissable; re-shows on every session start.
   - **(c) Inline feed header** — one-line header at top of feed area:
     *"AI-generated commentary — parodies of public figures, not real
     people."*
   - **My recommendation from last session: (a) + (c) together.** Permanent
     anchor + crisp session-start signal. Also works for screenshots /
     quote cards.
   - Seth has not yet picked. Flag for next session.

3. **CHANGELOG v2.0.1 entry** — add above [2.0.0] block. Should cover:
   mip_opt_out, cap-reached UX, Plus-tab popup, AI-disclosure banner,
   entity flip to Manu Games LLC, ToS + Privacy rewrite (cross-ref site
   commits).

4. **Manifest version bump** — `1.8.0` — wait, already done, `2.0.0`.
   Bump to `2.0.1`.

5. **Repack CWS zip** — `bash scripts/pack-extension.sh` produces
   `releases/peanut-gallery-v2.0.1.zip`. Upload to CWS.

---

## Onboarding wizard — product direction Seth wants next

This is the **main deliverable for the next session.** Seth's exact
framing: *"I want to move forward with the create your own key onboarding,
and I want it to work into the current use your own keys mode."*

### Why this is the right product move

The legal brief makes clear that **Plus as a bundled-API tier is off the
table** until either (a) Anthropic + Deepgram paper reseller approvals or
(b) we re-architect as pre-paid BYOK relay. Seth deferred Plus to v2.5+.

That leaves a gap for non-technical users: BYOK is free forever, but
setting up Deepgram + Anthropic + xAI + Brave accounts is a 15–30 minute
slog with four separate signups, four credit cards, four API-key
navigations. That friction is the #1 reason non-tech users bounce.

The onboarding wizard solves that friction **without making Manu Games
the API customer.** Users create their own provider accounts via guided
signup; keys end up in `chrome.storage.local` same as the current BYOK
path; Manu Games has zero key custody, zero resale exposure, zero
§D.4 / §2.3(c) risk. The wizard is pure UX value-add.

It also becomes the skeleton for Plus at v2.5+ — once provider
partnership approvals arrive, "create your own keys" becomes "create
your own keys (free) / have us create them for you (Plus, $8/mo)."

### UX spec (target for next session)

**Entry point:** in the Backend & keys drawer section, when `backendMode
=== "byok"` (i.e., "My keys" is selected), show a new expandable panel
**above** the existing key input rows:

> **Need keys? We'll walk you through it.** ~10 minutes. Free-tier
> credits cover typical use for weeks. [Start wizard ↓]

Clicking Start expands a stepper with 4 steps (3 required, 1 optional):

**Step 1/4 · Deepgram (speech-to-text).** Explanation of what it does
(transcription — turns tab audio into text). One-click "Open Deepgram
signup ↗" button opens `https://console.deepgram.com/signup` in a new
tab. Below: screenshot or annotated bullet list showing where the key
lives after signup (Console → API Keys → Create API Key → name it
"Peanut Gallery"). Paste field directly in-step; value propagates to
the existing Deepgram field below (one source of truth). Checkmark
appears when key is valid (format check — Deepgram keys are hex).
"Skip for now" option that marks the step incomplete but lets the user
advance.

**Step 2/4 · Anthropic (Claude — fact-checker + comedy writer).**
Same shape. `https://console.anthropic.com/signup`. Settings → API
Keys → Create Key. `sk-ant-…` prefix. Phone verification required
(warn user). ~$5 free credit on signup (verify current amount).

**Step 3/4 · xAI (Grok — troll + sound effects).** Same shape.
`https://console.x.ai/`. Phone verification. Credits on signup vary.

**Step 4/4 (optional) · Brave Search (fact-check grounding).** Mark
"optional" clearly. `https://api-dashboard.search.brave.com/app/subscriptions/subscribe`.
Has a $5/mo free-credit envelope, no free-forever tier. Pure add-on
that makes Baba Booey's fact-checks richer; extension works without
it.

**Completion state.** "You're set. Click Start Listening on any
YouTube tab." All four keys populated in the existing BYOK inputs
above; wizard collapses; user can re-open it anytime via an "edit
keys" link.

### Implementation notes

**Files to touch:**
- `extension/sidepanel.html` — new `<section>` inside the Backend &
  keys drawer above the existing BYOK inputs. Probably ~100 lines
  of markup.
- CSS: ~40 lines for stepper / checkmarks / expand-collapse.
- `extension/sidepanel.js` — wizard state, step progression,
  `chrome.tabs.create` for opening provider signup URLs, paste-to-field
  wire-up. ~150 lines.
- Copy: per-provider instructions + "what does this do" + "what does
  it cost" micro-copy. ~100 lines.

Total scope: ~400 lines. Fits in v2.0.1 if Seth wants, or v2.0.2 as a
first post-launch add. **Don't block v2.0.1 on it** if the rest of the
batch is ready to ship; iterate after.

**Legal framing for the wizard:**
- In-wizard copy should say "Free with your own keys forever" — the
  market-differentiation anchor.
- "We never see your keys. They live in your browser and go directly to
  each provider from your computer." — the zero-custody promise.
- Link to Privacy Policy BYOK section where the non-processor stance is
  spelled out.

**Tracking + telemetry (optional but valuable):**
- Count wizard-started vs. wizard-completed events. Feedback-opt-out
  respected. Drop keyed to install ID only.
- Count per-step completion to find the drop-off provider.
- Operational telemetry only; no key text, no PII.

### What this unlocks for Plus at v2.5+

The onboarding wizard makes the Plus value proposition crisper:

- **BYOK (free forever):** walks you through creating 4 provider
  accounts in ~10 minutes. You own everything. Free-tier credits cover
  typical use for weeks. The wizard lives here.
- **Plus ($8/mo, v2.5+):** we create the provider accounts for you,
  manage keys server-side with hard usage caps, roll forward on
  model upgrades, fail over across providers on outages. The
  "no-setup" tier for non-tech users who didn't want to do the wizard.

Seth's quote: *"I love the onboarding experience. I'm not sure how it
justifies the price, but if you can flesh that idea out for me, I'm
sure there is something there we want."* The fleshed-out value prop
(setup friction removal + managed caps + model-upgrade seamlessness +
provider failover + aggregated pricing leverage) is in the prior
session's transcript and should be mirrored into the v2.5+ Plus
architecture decision doc when that work begins.

---

## Open product + strategic decisions (Seth's calls)

### Jason Calacanis consent path

Seth raised the question: *"If Jason signs off on rmtp is there for
his personal use, any legal problem there?"*

**Short answer from the prior-turn analysis:** for Jason's **truly
private** personal use, essentially zero legal problem. Consent is a
complete defense to CA §3344, AB 1836, NY §51, and TN ELVIS Act for
the Jason persona specifically. **Does not transfer** to other
personas (Molly, Alex, Lon, Howard pack) — separate consents needed,
or keep parody framing.

**If pursued, paper it properly:**
- Written agreement (verbal doesn't hold up under § 3344).
- Scoped to "Peanut Gallery Chrome extension, hosted backend, and any
  RTMP / streaming tier."
- Revocability: 30-day notice forward-looking; no clawback of
  already-exported content.
- Endorsement rights: define explicitly — logo use, marketing
  citation, @jason tweet permissions.
- Consideration: some exchange of value — nominal $1, free future
  Plus subscription, revenue share, advisor equity, mutual promotion.
- Mutual counsel review. Watch CA AB 2602 (2025) — voids
  replica-of-living-performer contracts without specific use
  description + counsel representation.

**Strategic value if Jason signs:**
- Clean launch story for the Jason persona specifically.
- Anthropic + Deepgram reseller conversations much warmer with a
  named first customer. "$5K TWiST bounty fulfilled" is a press hook.
- Potential v2.5 launch anchor: "Peanut Gallery, now available on
  TWiST with Jason's blessing."
- Doesn't unlock broadcast of ANY persona commenting on third
  parties during a Jason stream — claim-detector + soft-gate still
  required to prevent unconsenting names.

**Status:** parked. Revisit when Seth decides whether to approach
Jason directly or wait for organic traction.

### RTMP directions

Seth raised RTMP as a potential expansion. Three distinct directions
from the prior-turn analysis:

- **(A) RTMP out — Peanut Gallery as a broadcast source.** Personas
  render as video overlay piped to OBS → Twitch/YouTube Live. 2–4
  weeks of backend + compositing work. Legal exposure multiplies by
  viewer count because Manu Games becomes the publisher. v3.0
  timeframe; a strategic conversation, not a v2.x.
- **(B) RTMP in — replace chrome.tabCapture with server-side RTMP
  ingest.** User points at an RTMP URL; backend decodes + routes to
  existing Deepgram pipeline. 1–2 weeks backend work. Opens up
  podcasters, live-event commentators, meetings. Tied to the Plus
  relaunch story at v2.5+.
- **(C) RTMP in user's own workflow — zero product change.** User
  streams their own show via RTMP → YouTube Live or Twitch,
  Peanut Gallery extension watches the YouTube Live tab. Already
  works. Just needs a manual page documenting the workflow.

**Recommended sequencing:** C free, whenever. B paired with Plus
relaunch at v2.5+. A later, if ever — strategic call.

---

## Architecture reference

### Key files + responsibilities (for orientation)

**Personas + packs**
- `lib/personas.ts` — `Persona` type, `buildPersonaContext`, the
  inspired-by PARODY FRAME injection (new field + injection block),
  four-flavor producer scaffolding (`fact-checker` /
  `heckler` / `journalist` / `layered-fact-checker`).
- `lib/packs/howard/personas.ts` — Howard pack Persona entries. All 4
  now carry `inspiredBy`. Baba on `layered-fact-checker`.
- `lib/packs/twist/personas.ts` — TWiST pack. Molly on
  `layered-fact-checker`. Jason, Alex, Lon all tagged.
- `lib/packs/howard/prompts/*.ts` + `lib/packs/twist/prompts/*.ts`
  — per-persona KERNEL + REFERENCE strings. Baba + Molly kernels
  now embed the four-tier fact-check-layer taxonomy.

**Director + engine**
- `lib/director.ts` — pack-agnostic routing (rule-based scorer).
- `lib/director-llm-v2.ts` — v2 LLM router (Haiku tool_use).
- `lib/director-llm-v3-cerebras-v3prompt.ts` — v3 shadow on Cerebras
  Llama 3.1 8B. Session's `coerceLooseFields` now handles three
  observed schema-echo malformations.
- `lib/director-llm-v3-groq-v3prompt.ts` — v3 shadow on Groq.
- `lib/persona-engine.ts` — fire logic, search integration
  (producer-only, `persona.id === "producer"`), safety net on
  producer "-" pass.
- `lib/transcription.ts` — Deepgram WebSocket. Now sends
  `mip_opt_out=true` on every connection.

**Extension**
- `extension/sidepanel.html` — settings drawer (7-item menu: Lineup,
  Backend & keys, Audio, Mute a critic, Export, Appearance, Privacy,
  Feedback & bugs). New visible parody notice at bottom of Lineup.
- `extension/sidepanel.js` — drawer logic, backend-mode state,
  SUBSCRIPTION_CAP_REACHED / INVALID / DISABLED handlers,
  Plus-tab-shows-popup patch (uncommitted), `pgBackendMode: "plus"`
  → `"demo"` load-time degradation.
- `extension/manifest.json` — v2.0.0, `homepage_url` added.

**Legal docs**
- `site/terms/index.html` — Manu Games LLC, Plus deferred,
  AI-training + DMCA + Export sections, AI output and persona framing.
- `site/privacy/index.html` — mirror updates, BYOK
  not-a-processor language, retention table trimmed of Plus rows.
- `legal-research/BRIEF-2026-04-24.md` — lawyer's brief. Single
  source of truth for statutory + provider-ToS analysis.
- `docs/FACT-CHECK-LAYER.md` — persona-agnostic fact-check
  methodology (CONFIRMS / CONTRADICTS / COMPLICATES / THIN).

### Provider ToS constraints (brief §1)

| Provider | Resale by default | Flow-down required | Indemnity to end users | Training opt-out | Key risk |
|---|---|---|---|---|---|
| Anthropic | **No** (§D.4) | Implicit (AUP passthrough) | No | Default non-training | §D.4 breach → key death |
| xAI | **Yes** (§1.2 Bundled Services) | Yes (§2) | No | Non-training + 30-day auto-delete (§3.3) | Customer indemnifies xAI for subscriber claims |
| Brave | **No** (§3(b)(xii)) | Yes (§4(c)) | Via §12 cap | Not applicable | Attribution + caching rules |
| Deepgram | **No** (Console §2.3(c), MSA §2.1) | Not explicit | No | `mip_opt_out=true` per request (now set) | Training license + resale bar |

Only Deepgram's `mip_opt_out=true` is a per-request operational config
we control. The other three are contract terms. BYOK removes all four
provider-ToS risks because users are in direct privity under their own
terms — the reason the onboarding wizard is the strategic move.

### Right-of-publicity state summary (brief §8A)

| Statute | Scope | Remedies | Applies |
|---|---|---|---|
| CA Civ. Code §3344 | Living; name/voice/signature/photo/likeness | $750 floor, actuals, profits, **mandatory fees** | Calacanis |
| CA §3344.1 + AB 1836 | Deceased; digital replica | $10K floor for replica | future |
| CA AB 2602 | Contracts authorizing replica of performer | Voids unless specific-use + counsel | Jason-consent paper |
| NY §51 | Living; advertising/trade; "voice" covered | Injunction, actuals, punitives | Dell'Abate |
| NY §50-f | Deceased performers; digital replica | $2K floor, fees | future |
| TN ELVIS Act §47-25-1105 | Voice simulation explicitly covered; tool-liability §47-25-1105(b) | Treble + fees | all personas if voice clone (we don't) |
| IL IRPA (HB 4762 2025) | Living; digital replica | $1K floor, fees | potential forum |
| IN IC 32-36-1 | Extraterritorial by statute | Strong remedies | any plaintiff |
| NC common law | *Flake v. Greensboro News* appropriation | Narrower | home forum |

**Mitigations in place:**
- Inspired-by parody frame in every persona prompt (session commit
  `d1f7a41`).
- Synthesized text only — no voice clone, no image likeness, no
  sampled audio. Documented in ToS "AI output and persona framing."
- In-product parody notice at Lineup drawer section.
- Takedown path at `legal@peanutgallery.live`.

**Mitigations still TODO:**
- Private-figure claim-detector block (brief §12.8).
- DMCA agent registration at copyright.gov.
- Media-liability insurance.
- Optional: Jason consent paper (strategic).

---

## Questions for Seth at next session start

Picking these up will unblock v2.0.1 finalize:

1. **Entity confirmation.** Manu Games LLC? If yes, I ship. If sole
   prop, flip one string on ToS + Privacy.
2. **AI-disclosure banner UX** — masthead badge / toast / inline feed
   header / combo. My vote: masthead + inline combo.
3. **`ENABLE_SUBSCRIPTION=false`** flipped on Railway? (Your dashboard
   action; confirm when done for the CHANGELOG.)
4. **`legal@peanutgallery.live` and `dmca@peanutgallery.live` inbox
   status.** If not set up, consolidate or configure.
5. **DMCA agent registration at copyright.gov** — $6/3yr, ~10 min.
   Yours to do.
6. **Onboarding wizard scope for v2.0.1 vs. v2.0.2.** Ship with the
   compliance-pass batch, or punt to the next release? The wizard is
   the strategic value-add that partially offsets the Plus deferral;
   v2.0.1 is a strong slot for it.

---

## Out-of-scope parking lot

Items surfaced this session that are NOT for v2.0.1 and NOT blocking
anything:

- **Baba pass-rate tuning.** Live-log data from v2.0 captures will
  drive the tuning pass. Queued for post-v2.0 iteration.
- **Llama 3.3 70B swap on Cerebras** as structural fix for Llama 3.1
  8B schema-echo shadow failures. Current coercion handles three
  observed malformations; a model swap fixes it at the root.
  Evaluate post-v2.0.
- **Delete `app/privacy/page.tsx`** Next.js dead-code route
  (308-redirected by middleware; unreachable). Cleanup only.
- **"Draft pending legal review" banner removal** on the dead-code
  Next.js privacy page. Same cleanup.
- **Lemon Squeezy MoR switch.** Tied to Plus relaunch at v2.5+.
- **Apache 2.0 relicense.** Post-ship decision per Seth.
- **USPTO trademark filing.** Post-first-paid-subscriber for
  first-use-date anchor.
- **Cookie-consent banner.** Brief §7D says IP-block EU from Plus
  funnel is cleaner than implementing banner at <1K subscribers.
- **Formal arbitration clause.** Pending counsel review.
- **Plus relaunch architecture** — pre-paid BYOK relay vs. bundled
  with reseller approvals. Core v2.5 decision.

---

## Session continuity note

Context at this session-end was nearly full. Next session should:
1. Read this doc top-to-bottom.
2. Resolve the six questions above.
3. Implement the onboarding wizard per the spec above.
4. Commit + bump to v2.0.1 + CHANGELOG + repack CWS zip.
5. Hand off the zip for Seth's CWS upload.

Everything else on the POST-v2.0 list is backlog.
