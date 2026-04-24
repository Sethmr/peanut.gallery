# Changelog

All notable changes to Peanut Gallery are recorded here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); version numbers follow [SemVer](https://semver.org/).

## [Unreleased]

Tracks in-flight work for the next release. Live on develop but not yet cut into a release branch.

- Baba fact-check-layer pass-rate tuning based on live-log data (deferred post-v2.0 per Seth).
- Llama 3.3 70B swap evaluation on Cerebras as a structural fix for Llama 3.1 8B's schema-echo shadow failures.
- Post-lawyer-brief legal updates: remove "Draft pending legal review" banners, add AI-training-data disclosure, DMCA safe-harbor section.

---

## [2.0.0] — 2026-04-23 — "The Gallery"

**Chrome Web Store launch release.** Main reopens for the first time since v1.5.3 "The Cast" (2026-04-20). The v2.0 manifest carries every `develop`-only release that accumulated on Railway: v1.6.0 "The Canary" (Smart Director v3 flag-gated canary), v1.7.0 "The Fine Print" (legal hard-save), v1.8.0 "The Press Pass" (Peanut Gallery Plus live end-to-end), and this session's polish + fact-check-layer work. Those entries are preserved below unchanged.

Single load-bearing addition in this manifest bump: **the fact-check layer methodology**, a voice-agnostic scaffolding that makes character-driven producer personas (Baba Booey, Molly Wood) functional real-time fact-checkers without collapsing their voice. First two applications land in v2.0; the methodology doc ([`docs/FACT-CHECK-LAYER.md`](docs/FACT-CHECK-LAYER.md)) is written persona-agnostic so future producers can opt in.

### Added
- **Fact-check layer — methodology + first two applications.** New research-backed four-tier output taxonomy (CONFIRMS / CONTRADICTS / COMPLICATES / THIN) with canonical in-voice line patterns, an ASR-slip guard, a precise pass rule, and cascade / war / sourcing discipline. Compiled from AVeriTeC + FEVER + PolitiFact / AP / FactCheck.org + Swire-Thompson correction-psych + Szymański et al. ASR-NER + Stewart / Oliver "jokes don't work when they're lies" framing. Applied to Baba Booey (trolly-EP register, full patch in [`lib/packs/howard/prompts/baba-booey.ts`](lib/packs/howard/prompts/baba-booey.ts)) and Molly Wood (NPR-journalist register, full patch in [`lib/packs/twist/prompts/molly-wood.ts`](lib/packs/twist/prompts/molly-wood.ts)). New `producerMode: "layered-fact-checker"` scaffolding flag in [`lib/personas.ts`](lib/personas.ts) — voice-agnostic, swaps the legacy `[FACT CHECK]/[HEADS UP]` EVIDENCE-gate tag system for the new four-tier taxonomy. Methodology in [`docs/FACT-CHECK-LAYER.md`](docs/FACT-CHECK-LAYER.md); step-by-step procedure for applying it to future producers at the bottom of that doc.
- **Inspired-by parody frame** (anti-impersonation hedge). New `persona.inspiredBy` field on every persona whose kernel uses direct "You are \<real name\>" framing (all 8 tagged). `buildPersonaContext` prepends a **PERSONA FRAME (parody / inspired-by disclosure)** block above every other instruction at fire time, marking the output as unofficial, unauthorized fan parody and teaching the model to clarify that it's an AI fan parody if a user asks whether it IS the real person. Single point of truth for the hedge promised in [`site/terms/`](https://www.peanutgallery.live/terms/) (IP paragraph), the homepage "Homage" block, and the pack-page FAQs. Visible parody notice also added to the Lineup drawer section so users see the framing where pack names are shown.
- **"Feedback & bugs" settings-drawer section.** New menu item after Privacy with a pre-filled **Report a bug** link to GitHub (routes through `bug_report.yml` issue template), a **Send feedback by email** mailto to `support@peanutgallery.live`, and a secondary **Browse existing issues** link. Zero JS changes — drawer routing is `data-section` attribute driven.
- **Mute-sfx toggle** in the Audio settings drawer. Persists in `chrome.storage.local` as `muteSfx`; gates `playPersonaCue()` on the flag. Cue playback volume also dropped from 1.0 → 0.67 so earcons sit further under content audio.
- **Bowling-pin cue for Jason** (TWiST troll slot). Seth-delivered ElevenLabs render, normalized to the cue-set RMS/peak targets. Jackie and Jason also swap earcons so the previously-paired Jackie cue now plays for Jason. Mirror swap applied to [`scripts/synth-persona-cues.ts`](scripts/synth-persona-cues.ts) so a regen doesn't undo it.
- **Fred + Lon cue trims.** `howard-soundfx.wav` trimmed 1.58s → 0.75s with fade; `twist-soundfx.wav` trimmed 1.87s → 0.80s with fade. Earcons now consistently sit under 1s for a cleaner per-persona transition.
- **`homepage_url` in manifest** — points at `https://www.peanutgallery.live/`. CWS-dashboard hygiene; surfaces the marketing site alongside the listing.

### Changed
- **Baba Booey archetype** — flipped back from v1.8-morning "trolly heckler" (`producerMode: "heckler"`) to "trolly-EP fact-checker" (`producerMode: "layered-fact-checker"`) with the new four-tier taxonomy embedded in the kernel. Role string: "The Heckler" → "The Fact-Checker". directorHint rewritten to lead with the reporter-desk fact-check posture while preserving heckle triggers.
- **Molly Wood archetype** — flipped from v1.8-morning "NPR-journalist" (`producerMode: "journalist"`, `REPORTING ANCHORS` framing) to the same shared `layered-fact-checker` scaffolding with the four-tier taxonomy, canonical lines rewritten in her reporter-desk register. Voice contract (NPR register, concession-then-pivot, inline source anchors) is unchanged. Role string: "The Journalist" → "The Fact-Checker".
- **`producerMode` type** — new `"layered-fact-checker"` value on the union; historical `"heckler"` and `"journalist"` values preserved for back-compat but unused on current develop.
- **Legacy EVIDENCE-availability gate** (`lib/personas.ts`) — comments updated to flag the block as effectively dead code on current develop (both producers use the new layer; the `[FACT CHECK]`/`[HEADS UP]` tag prescriptions the gate carries are superseded). Preserved for back-compat in case a future pack opts into legacy `"fact-checker"` explicitly.

### Fixed
- **Cerebras v3 shadow log spam** ([`lib/director-llm-v3-cerebras-v3prompt.ts`](lib/director-llm-v3-cerebras-v3prompt.ts)). Llama 3.1 8B on Cerebras echoes back the JSON Schema definition instead of an instance in a non-trivial fraction of calls. New `isPureSchemaDump` helper detects this second failure mode (previously only the enveloped-instance case was unwrapped) and demotes the log level from `warn` to `debug` with a `schema_dump` reason tag. New `coerceLooseFields` helper recovers two additional field-level malformations observed in live logs: stringified-JSON `confidence` and literal string `"null"` for `callbackUsed`, plus a partial-schema-envelope wrapping of the confidence object. All three coercions produce usable picks that would previously have been discarded. Shadow-path only; no runtime behavior change. Result: Railway logs drop from dozens of `warn`-level Cerebras lines per session to zero visible at default log level.
- **Broken cross-doc legal links** ([`site/terms/`](https://www.peanutgallery.live/terms/) + [`site/privacy/`](https://www.peanutgallery.live/privacy/)). Both pages linked to `docs/SELF-HOST-FOR-INTERNATIONAL-USERS.md` which doesn't exist. Pointed both at the real `docs/SELF-HOST-INSTALL.md`. Privacy's Recording-consent section linked to a markdown-fragment anchor (`.../TERMS-OF-SERVICE.md#51-audio-capture-and-recording-consent-laws`) that doesn't resolve against the canonical HTML ToS; added `id="acceptable-use"` to the Acceptable-use H2 in `/terms/` and retargeted the privacy link at `/terms/#acceptable-use`.
- **Stale email on legacy Next.js `/privacy` route** ([`app/privacy/page.tsx`](app/privacy/page.tsx)). Referenced `seth@manugames.com` from a different project; updated to `legal@peanutgallery.live` to match every other surface. Dead-code path behind the apex→www middleware 308, but still user-visible if middleware ever misconfigures.

### Docs
- **`docs/FACT-CHECK-LAYER.md`** — persona-agnostic methodology doc. 10 sections (operating essence, tier taxonomy, tier-to-voice mapping, ASR-slip guard, pass conditions, sourcing rules, anti-repetition discipline, war/politics red lines, 10 red-team cases) plus a 5-step "apply to a new persona" procedure pointed at Molly as the first reuse candidate (since landed).
- **`site/pricing/` FAQ** — new "Are these the real people?" entry with inspired-by disclaimer + takedown email + matching JSON-LD entry for rich-result eligibility.
- **`site/terms/` + `site/privacy/`** — Twitter Card meta + `og:image:width/height/alt` backfilled (were the only site pages missing them).
- **INDEX.md + lib/packs/INDEX.md + README.md version tables** — rewritten around v2.0 as the accumulating manifest bump, with accurate descriptions of the layered-fact-checker scaffolding and the PARODY FRAME mechanism.

### Chore
- **Audit sweep** — reconciled stale v1.8-morning references in `lib/packs/howard/personas.ts` header docstring, `lib/packs/INDEX.md` pack-module table, and the PRODUCER SEARCH-RESULTS + EVIDENCE-gate comments in `lib/personas.ts`. All four docs now match the current `layered-fact-checker` reality.

---

## [1.8.0] — 2026-04-22 — "The Press Pass"

The Peanut Gallery Plus subscription goes live end-to-end. Hosted backend is live on Railway from `develop`; main stays frozen until v2.0 per Seth's release plan, so this is the operative production version even though it isn't in the Chrome Web Store zip yet. v1.6.0 "The Canary" + v1.7.0 "The Fine Print" (legal rewrites, hard-save branches) absorbed into this manifest bump — the actual canary + legal work rides along.

Single load-bearing change: **non-technical users can subscribe**. Four-way access picker (Demo / Plus / My keys / Self-host) ships in the Backend & keys drawer, the 15-minute one-off demo replaces the old rolling free tier, and Plus is $8/mo for 16 h/week with a license-key identity and one-click recover-key on the already-subscribed path.

### Added
- **Peanut Gallery Plus — Phase 2 persistent identity** (PR [#123](https://github.com/Sethmr/peanut.gallery/pull/123), SET-25). SQLite-backed subscription store via `better-sqlite3` with WAL journaling, case-insensitive email lookup, Luhn-checksum license-key generator (`pg-xxxx-xxxx-xxxx`), and an admin CLI (`npm run subscription:issue`). Pluggable store: `SUBSCRIPTION_DB_PATH` opts into SQLite; unset preserves Phase 1 in-memory env-whitelist exactly. Encryption-at-rest via optional SQLCipher key or filesystem-level disk encryption. Paired 252-assertion test suite exercises both Memory and SQLite backends.
- **Peanut Gallery Plus — Phase 3 Stripe integration** (PR [#124](https://github.com/Sethmr/peanut.gallery/pull/124), SET-26). Real Stripe Checkout session creation + webhook signature verification (manual HMAC, no `stripe` npm dep) + event handlers for `checkout.session.completed` / `customer.subscription.updated` / `customer.subscription.deleted` / `invoice.payment_succeeded` / `invoice.payment_failed`. Four-layer US-only enforcement (client confirm, route check, Stripe `shipping_address_collection.allowed_countries`, webhook post-verify with refund + revoke if non-US slips through). Idempotent on `stripe_sub_id`.
- **Peanut Gallery Plus — dedupe gate** (this release). Checkout refuses a second Stripe session for an email that already has an active Plus record, returning `409 ALREADY_SUBSCRIBED`. Extension surfaces this as a modal with a one-click **"Email me my key"** CTA that fires the recover-key flow against the already-typed email. Prevents the accidental-double-click path that would otherwise create duplicate Stripe customers, two $8/mo charges, and two valid keys. Revoked/cancelled rows don't block — former subscribers can resubscribe cleanly.
- **Free-tier onboarding UI + four-mode access picker** (this release). Backend & keys drawer now has a segmented control for **Demo / Plus / My keys / Self-host** (previously three-way). 15-minute one-off free banner with live countdown + demo-mode exhaustion logic that hides the Demo option after the trial burns. Start Listening gates key-presence on the selected mode, not on URL — "My keys" on the default hosted URL now correctly warns instead of silently using the server's demo keys.
- **`openPromptModal` info-mode** (this release). `hideInput: true` turns the branded prompt card into a confirm dialog (no input, confirm resolves `true`). Used for drawer-triggered confirmations where the main-panel error banner is invisible behind the drawer. Memory note: `feedback_modal_for_drawer_triggered_errors.md`.
- **Feed-menu: Regenerate this take** (PR [#128](https://github.com/Sethmr/peanut.gallery/pull/128)). Re-fires the persona slot on a feed entry for a fresh output — useful when a line doesn't land. Rate-limited per-entry; wired through `Director.forceReact` with the same cooldown math.
- **Per-persona fire-count chip + top-talker accent** (PR [#129](https://github.com/Sethmr/peanut.gallery/pull/129)). Persona mugs show a session fire count; the top talker gets an accent color so the balance of voices is legible at a glance.
- **Elapsed session timer in status bar (paid modes)** (PR [#130](https://github.com/Sethmr/peanut.gallery/pull/130)). H:MM:SS counter in the status strip while capturing, shown only when the session is consuming paid/subscription time. Resets on stop; doesn't persist across reloads.
- **Transcript pulse on persona fire** (PR [#131](https://github.com/Sethmr/peanut.gallery/pull/131)). Visual link "this → them" — the transcript line that triggered a persona briefly pulses in time with the persona avatar's firing animation.
- **User-facing feedback opt-out toggle** (PR [#127](https://github.com/Sethmr/peanut.gallery/pull/127)). Privacy drawer gets a switch that sends `X-Disable-Feedback: true` so the server drops `persona_feedback` telemetry for that install. Mirrors the self-host `DISABLE_FEEDBACK_LOGGING=true` env var at the client layer.
- **Fact-check hardening** (PR [#120](https://github.com/Sethmr/peanut.gallery/pull/120)). Claim-detector gains spoken-number normalization ("three billion dollars" → "3 billion dollars"), structured attribution patterns, funding-round + acquisition recognition, and a compound-claim bonus that ranks dense claims first. Evidence-gated producer tiers (GREEN / THIN / NONE) with a QUICK SELF-CHECK (CoVe) block. Director claim-density boost (+0.5 → +2.0, capped). Supersedes reverted PR [#125].
- **Quote-card PNG renderer** (PR [#105](https://github.com/Sethmr/peanut.gallery/pull/105), SET-23). Agent-delivered. Tapping "Make a quote card" on any feed entry now renders a 1200×1200 Broadsheet-style PNG to the clipboard (with download fallback). `OffscreenCanvas` + `document.fonts.ready` gate; SVG mascot via Blob URL (no eval, no remote fetches — design principle #5 preserved); CSS custom properties read live so Paper and Night themes render correctly without hardcoded colors. New file `extension/lib/quote-card.js`; stub `openQuoteCardPlaceholder` renamed to `exportQuoteCard` in sidepanel.js.
- **Smart-highlight picker** (PR [#104](https://github.com/Sethmr/peanut.gallery/pull/104), SET-24). Agent-delivered. New `lib/highlight-picker.ts` pure module picks the single best moment from a session's persona fires. Priority: pin wins → upvote shortlist (Haiku `tool_use` with strict enum over real entryIds if key present; else most-recent upvote) → scored fallback (substance × diversity × recency-decay; Haiku picks top-5 if key present; else highest-scored). Paired test file exercises all four paths with mocked Anthropic client.
- **Peanut Gallery Plus — Phase 4 email infrastructure** ([SET-27](https://linear.app/seth-dev/issue/SET-27)). Agent-delivered. Transactional email transport for welcome / recovery / cancellation / magic-link sends. Provider: **Resend** by default (`EMAIL_PROVIDER=resend`, raw `fetch` so no new dependency); **Postmark** drop-in fallback (`EMAIL_PROVIDER=postmark`, same wire shape). New `lib/email.ts` exposes `sendWelcomeEmail` / `sendRecoveryEmail` / `sendCancellationEmail` / `sendMagicLinkEmail` — each returns `{ok, id, error, skipped}`, never throws. Templates in new `lib/email-templates.ts` are pure render functions returning `{subject, html, text}`; HTML escapes all interpolated values; no remote assets (inline styles only — survives client-side image blocking + avoids tracking-pixel optics). `/api/subscription/manage` now actually sends recovery + magic-link emails (was a stub); `findActiveKeyByEmail` added to `lib/subscription.ts` for the reverse lookup. Failure posture is load-bearing: send failures log loud (`subscription_email_failed` JSONL event) but **never** throw and **never** cause a non-2xx — Stripe webhook would retry-and-dupe-issue keys. Privacy: no enumeration leak (recover/manage responses identical regardless of whether the email is on file); email addresses masked in log lines (`al***@example.com`). Self-host opt-out via `DISABLE_EMAIL_SEND=true`. Phase-3 webhook handler wires welcome + cancellation calls when SET-26 lands. Architecture: [`docs/SUBSCRIPTION-ARCHITECTURE.md § Phase 4`](docs/SUBSCRIPTION-ARCHITECTURE.md).
- **Peanut Gallery Plus subscription scaffold** (this session). $8/month · 16 h/week · license-key identity. Non-techs can reach the product without managing API keys; BYOK stays free forever. Three-option segmented control in Backend & keys (Demo / My keys / Plus) + subscription key input + weekly progress bar + Subscribe/Manage buttons. When Plus and BYOK are both configured, a sub-toggle picks which keys burn on each session; subscription hours only consume when using hosted keys. Backend: `lib/subscription.ts` (key validation + usage metering) + `/api/subscription/{status,checkout,manage,webhook}` endpoints (status real; Stripe + email flows stubbed until SET-25/26/27 ship). Feature-flagged behind `ENABLE_SUBSCRIPTION=true`; self-hosters never see it unless they flip the flag. Canonical architecture in [`docs/SUBSCRIPTION-ARCHITECTURE.md`](docs/SUBSCRIPTION-ARCHITECTURE.md); legal drafts at [`docs/legal/TERMS-OF-SERVICE.md`](docs/legal/TERMS-OF-SERVICE.md) + [`docs/legal/PRIVACY-POLICY.md`](docs/legal/PRIVACY-POLICY.md) (lawyer review pending).
- **Server-side feedback telemetry** (PR [#101](https://github.com/Sethmr/peanut.gallery/pull/101)). `POST /api/feedback` writes `persona_feedback` events to `logs/pipeline-debug.jsonl` on every upvote/downvote/pin/unpin/quote-card action. Powers model tuning, the v1.8 persona-refinement sprint, and a future server-side fallback for the smart-highlight picker. `DISABLE_FEEDBACK_LOGGING=true` is the self-hoster opt-out. Fire-and-forget on the client; local state stays authoritative.
- **Feed-entry action menu** (PR [#99](https://github.com/Sethmr/peanut.gallery/pull/99)). Tap any persona response → popover with Make a quote card / Pin to top / Upvote / Downvote. Keyboard-accessible (Arrow Up/Down/Home/End navigate items; Escape / outside-click dismiss; first item auto-focuses on open). Vote/pin state persists per-session via `chrome.storage.local`. Quote-card action currently ships a plain-text stub + clipboard write; full PNG renderer tracked as [`SET-23`](https://linear.app/seth-dev/issue/SET-23).
- **Pinned-strip drop-down** (PR [#99](https://github.com/Sethmr/peanut.gallery/pull/99)). Newspaper-styled card drops down above the feed with a transform+opacity transition. One pin at a time; collapse button hides body without unpinning; × clears. Shares visual language with the pending quote-card PNG so the render pipeline can lift styles directly.
- **Room Volume segmented control** (PR [#99](https://github.com/Sethmr/peanut.gallery/pull/99)). Three-option dial (Quieter / Normal / Rowdy) in the Critics drawer. Wired end-to-end via `X-Sensitivity` header → `Director.decide({ sensitivity })` → cascade-probability scaling (0.5× / 1.0× / 1.5×). Applied after the Troll floor so user preference wins. Persisted globally as `pgSensitivity`.
- **Tutorial expanded to 6 steps** (this session). Added *Critics & Room volume* and *Tap a response* stops so new users discover the two v1.6.0 interactions. Final step opts out of DOM-spotlighting so it works on cold-start sessions with an empty feed.

### Changed
- **Producer correction-tier rebalance** (PR [#97](https://github.com/Sethmr/peanut.gallery/pull/97)). Both Baba Booey (Howard) and Molly Wood (TWiST) system prompts now define `[HEADS UP]` as the workhorse tier and restrict the `"-"` pass to genuinely content-free tails. Fixes the false-pass pathology where the Director picked the producer on tails with proper nouns but Baba / Molly passed, firing the fallback safety net instead. Log-confirmed on 2026-04-21: 9 consecutive fallbacks in 8 minutes on a TWiST episode.
- **Version badge reads manifest at runtime** (PR [#95](https://github.com/Sethmr/peanut.gallery/pull/95)). Was hardcoded `v1.5.1` in the masthead; now `chrome.runtime.getManifest().version`. Never goes stale again.
- **WIRE DOWN empty state names the configured backend** (PR [#96](https://github.com/Sethmr/peanut.gallery/pull/96)). Includes the localhost + `npm run dev` recovery hint inline so users can self-diagnose whether they're pointed at a dead hosted URL, a stopped local dev server, or a typo.
- **Settings gear ⚙ is bigger + higher contrast** (PR [#96](https://github.com/Sethmr/peanut.gallery/pull/96)). Font-size 13→20 px, color `--ink-3` → `--ink` at 0.85 opacity, `:focus-visible` outline for keyboard nav.

### Fixed
- **Already-subscribed UX shows a modal, not a silent banner** (this release). The main-panel `#errorBanner` is invisible behind the settings drawer, so a 409 ALREADY_SUBSCRIBED on checkout had no visible effect. The dedupe response now triggers a branded confirm modal with the "Email me my key" CTA + a follow-up "Check your inbox" confirmation on success. Lesson in auto-memory `feedback_modal_for_drawer_triggered_errors.md`.
- **SQLite write on Railway: container runs as root** (this release). Railway's persistent volumes mount as root:root; the non-root `USER nextjs` in the Dockerfile meant `better-sqlite3` failed with `unable to open database file` on `/data/subscriptions.db` — the store silently fell back to in-memory and wiped every subscription on redeploy. Removed the USER drop; root-in-container is the pragmatic trade-off on Railway's isolation model. `extension/Dockerfile` carries the rationale.
- **Start button mode gate is mode-based, not URL-based** (this release). Previously the missing-keys check only fired when the URL was self-hosted; users in "My keys" mode pointed at the default hosted URL silently fell through to the server's demo keys. Start now gates on `backendMode === "byok" | "selfhost"` regardless of URL, with a warning + "Open settings" CTA when keys are missing.
- **TDZ bug #1: v1.9 subscription scaffold killed every click handler** (PR [#106](https://github.com/Sethmr/peanut.gallery/pull/106)). The subscription code block at line ~534 referenced `const` DOM bindings declared at line ~828 (`backendModeSegmented`, `subscriptionKeyInput`, etc.). Top-level access before the declaration threw `ReferenceError: Cannot access '<name>' before initialization`, halting the entire script. No event listener past that point attached — settings gear, Start Listening, feed menu, tutorial, everything unreachable despite rendering correctly. Fix: hoisted the 12 subscription DOM refs to line ~534 above the block. Full post-mortem in [`DEBUGGING.md § ISSUE-010`](docs/DEBUGGING.md#issue-010-sidepanel-tdz--nothing-tappable-after-a-new-top-level-block).
- **TDZ bug #2: BYOK input loop hit the same trap** (PR [#112](https://github.com/Sethmr/peanut.gallery/pull/112)). Sibling bug in the same v1.9 block — a top-level `for` loop at line ~851 iterated over `[deepgramKeyInput, anthropicKeyInput, xaiKeyInput]`, all declared at line ~964. Same `ReferenceError`, same all-handlers-dead symptom. Only the `<a href>` "run your own backend" link still worked (browser-native navigation, no JS). Fix: reach through `document.getElementById(id)` inline instead of touching the later `const` bindings. Lesson recorded in auto-memory `feedback_sidepanel_tdz_lesson.md` and in [`AUDIT-2026-04-21.md`](docs/AUDIT-2026-04-21.md) as a resolved post-audit finding.
- **Masthead version badge reads manifest at runtime** (PR [#95](https://github.com/Sethmr/peanut.gallery/pull/95)). Previously a hardcoded `v1.5.1` string even after multiple version bumps.
- **Free-tier limiter is now one-off, not rolling.** 15-minute lifetime trial per install, not per-24h window. Self-hosters who want the old behavior set `FREE_TIER_WINDOW_HOURS=24`. Change aligns with the Peanut Gallery Plus v1.9.x direction: demo is a first taste, Plus is how non-techs sustain daily use.
- **60-second silence auto-stop** (PR [#92](https://github.com/Sethmr/peanut.gallery/pull/92)). RMS probe in the flush tick stops the session if audio stays below the noise floor for 60 s. Prevents a paused or idle tab from burning backend tokens on the router.

### Docs
- **Pack authoring guide** — [`docs/PACK-AUTHORING-GUIDE.md`](docs/PACK-AUTHORING-GUIDE.md) is the canonical producer contract (tier system, `factCheckMode` dial, anti-repetition, war-zone restraint) + archetype slot definitions + registration checklist + refinement loop. Living document; updated on every contract tightening.
- **Persona data-acquisition guide** — [`docs/PERSONA-DATA-ACQUISITION-GUIDE.md`](docs/PERSONA-DATA-ACQUISITION-GUIDE.md). Copy-paste operator guide for grabbing 75 h of in-voice transcripts under $20 using public sources. yt-dlp + whisper.cpp + selective Whisper API fallback. Feeds Phase 2 voice-pattern extraction (Claude does that work on the subscription, free).
- **Competitive landscape refresh** — [`docs/COMPETITIVE-LANDSCAPE-2026-04-21.md`](docs/COMPETITIVE-LANDSCAPE-2026-04-21.md). Feature-gap pass across adjacent products. Top-5 must-haves for v2.0 identified.
- **Pre-v2.0 audit** — [`docs/AUDIT-2026-04-21.md`](docs/AUDIT-2026-04-21.md). 19 findings triaged across UX / code / perf / tests / docs / dev-ex. 3 already resolved, 3 fixed inline (feed-menu keyboard nav, IndexedDB privacy disclosure, INDEX path-to-v2.0 paragraph refresh), 13 deferred with suggested tickets and cost estimates.
- **ROADMAP realignment** (PR [#93](https://github.com/Sethmr/peanut.gallery/pull/93)). Versioning now matches reality — v1.6.0 is "The Canary," not "Settings Pane"; retired slot labels collapsed. New sections: v1.9.x subscription tier (pre-v2.0 revenue test, 6-principle plan), v1.10.x avatar stage 2.
- **Subscription design principle** — `DESIGN-PRINCIPLES.md` rule 5a codifies the BYOK-primary / subscription-alternative posture with a weekly-hours cap targeted above top-10% usage.
- **"Personas over Director" design principle** — `DESIGN-PRINCIPLES.md` rule 3a codifies the fix-order (persona prompt → directorHint → factCheckMode → claim-detector patterns → router changes). Saved as auto-memory `feedback_personas_over_director.md`.
- **Cerebras integration guide** — [`docs/CEREBRAS-INTEGRATION.md`](docs/CEREBRAS-INTEGRATION.md). Step-by-step Railway operator setup for the v3 canary. $2 expected for a 48h canary run.
- **IndexedDB + CWS listing copy** callout in [`DESIGN-PRINCIPLES.md § 5`](docs/DESIGN-PRINCIPLES.md). "Sessions saved locally to your device; zero server storage" is the marketing phrasing for v2.0.

### Chore
- **Stripe live mode wired end-to-end** (this release). Live-mode restricted key + live price + dashboard-registered live webhook endpoint (5 events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_succeeded, invoice.payment_failed) on the Railway-direct URL, pending DNS for `api.peanutgallery.live`. Real-$8 smoke test charge + refund completed 2026-04-22.
- **Railway volume attached at `/data`** (this release). Persistent SQLite file lives on a mounted Railway volume; `SUBSCRIPTION_DB_PATH=/data/subscriptions.db` on the production env. Survives redeploys; dedupe gate has a durable store to read from.
- **Email-log redaction for PII** (PR [#126](https://github.com/Sethmr/peanut.gallery/pull/126)). Every pipeline log line that touches a customer email now passes through `emailForLog()` (`al***@example.com`) — compliance against a privacy-policy commitment, not a debugging choice.
- **Daemon auto-moves Linear tickets to "In Review" on PR open** (PR [#103](https://github.com/Sethmr/peanut.gallery/pull/103)). Previously relied on Linear's native GitHub integration, which required per-PR identifier linkage that wasn't reliably happening. Daemon now owns the Todo→In Review transition via GraphQL; emits `linear_transitioned_to_in_review` telemetry. Linear's native Merge→Done integration still handles close. Ticket's cached workflow-state UUID lookup means zero hardcoded IDs.
- **Linear tickets SET-23 / SET-24 / SET-25 / SET-26 / SET-27 all complete.** Subscription Phases 2–4 plus quote-card + highlight-picker all landed via daemon-spawned agents + direct commits in this cycle.

## [1.5.6] — 2026-04-20 — "<TBD>"

Dev-infrastructure release. No user-facing changes in the extension
itself. Ships the local Linear daemon — a launchd agent on Seth's Mac
that polls Linear for Todo-state issues, spawns headless `claude` CLI
runs in fresh worktrees, pushes branches, and opens PRs on `develop`.
Replaces the GitHub-Actions kickoff path for local-first AI work
using Seth's Claude Max subscription instead of API pricing.

### Added
- **Local Linear daemon on Seth's Mac** ([#52](https://github.com/Sethmr/peanut.gallery/pull/52)). New `scripts/linear-daemon.ts` polls Linear every 30s for issues moved to Todo, spawns `claude` CLI in fresh worktrees inside the project directory (live-viewable via `tmux attach -t claude-<id>`), pushes branch + opens PR on develop. Replaces the GitHub-Actions kickoff path for local-first AI work using Seth's Claude Max subscription instead of API pricing. See `docs/LINEAR-AGENT-RUBRIC.md` + `docs/GITHUB-MANUAL-STEPS.md § 18` for setup, plus `scripts/install-linear-daemon.sh` and `scripts/gallery.peanut.linear-daemon.plist` for the launchd agent install.

### Changed
- **Daemon uses `--allowedTools` allowlist** ([#54](https://github.com/Sethmr/peanut.gallery/pull/54)). Prior `--permission-mode acceptEdits` blocked the daemon from running `git add` / `git commit` headlessly. Explicit allowlist covers git, npm, node, tsx, jq, python, and common file ops while excluding network (curl/wget), remote (ssh/scp), privilege (sudo), and gh (daemon owns push/PR). Defense-in-depth against prompt-injected Linear ticket bodies.
- **Daemon output format defaults to streaming text** ([#53](https://github.com/Sethmr/peanut.gallery/pull/53)). Was `--output-format json`, which only prints a final result blob; switched to CLI default so `tmux attach` shows Cowork-level verbosity (streaming reasoning, tool calls with inputs, tool results).
- **Daemon rebases feature branch onto `origin/develop` before pushing + enables auto-merge by default** ([#56](https://github.com/Sethmr/peanut.gallery/pull/56)). Rebase ensures commit history between develop and the feature branch is linear; auto-merge squash-merges the PR when CI is green. Opt-out: `needs-review` label on the Linear issue (reserved for changes that need app-testing).
- **Daemon drops rebase-empty branches** ([#57](https://github.com/Sethmr/peanut.gallery/pull/57)). If rebase drops all of Claude's commits as already-applied to develop (patch-id match), daemon cleans up instead of pushing an empty branch + opening a no-op PR. Prevents duplicate commits end-to-end.

### Fixed
- (none in this release beyond the daemon operational fixes above)

### Removed
- (none — the older webhook + GH-Actions kickoff path is still in the tree; its removal is queued as a separate cleanup PR after the local daemon is verified in production.)

### Claude-authored ticket
- **SET-5 smoke test** ([#55](https://github.com/Sethmr/peanut.gallery/pull/55)). One-bullet addition to `docs/INDEX.md` pointing at `docs/LINEAR-AGENT-RUBRIC.md`. First fully-autonomous Claude PR from the local daemon, verifying the Todo → In Progress → In Review → Done Linear lifecycle end-to-end.

### Manual follow-ups for operators
- If using the local daemon: install with `PATH="$PWD/node_modules/.bin:$PATH" ./scripts/install-linear-daemon.sh` (PATH prefix because the installer needs `tsx` in-PATH to bake its absolute path into the launchd plist). Hardening queued for a future PR.
- Daemon env file at `~/.config/peanut-gallery/daemon.env` (mode 600) requires both `LINEAR_API_KEY` (Linear → Settings → API → Member API keys) AND `CLAUDE_CODE_OAUTH_TOKEN` (run `claude setup-token` in a terminal; token is Claude Max subscription-bound).
- **To un-process a Linear ticket for re-fire:** stop daemon FIRST (`launchctl unload …plist`), edit `logs/daemon-state.json` to remove the issue ID, THEN start daemon. Shutdown handler currently overwrites disk state on SIGTERM — race fix queued.

## [1.5.5] — 2026-04-20 — "<TBD>"

Dev-infrastructure release. No user-facing changes in the extension
itself. Establishes the Linear-driven kickoff pipeline for AI work,
refreshes runtime + dev dependencies, tightens the release branch
model, and bumps CI actions off the deprecated Node 20 runtime.

### Added
- **Linear ticket → Claude Code kickoff pipeline** ([#46](https://github.com/Sethmr/peanut.gallery/pull/46)). New `/api/linear-webhook` route receives Linear issue webhooks and dispatches to a new `claude-kickoff.yml` GitHub Actions workflow. Claude creates a branch, implements the ticket on develop, and opens a PR. Trigger: move a Linear issue to the Todo state. See `docs/LINEAR-AGENT-RUBRIC.md` + `docs/GITHUB-MANUAL-STEPS.md § 17`.
- **`@claude` PR-reply workflow** ([#46](https://github.com/Sethmr/peanut.gallery/pull/46)). New `claude-reply.yml` — mention `@claude` on a PR as @Sethmr and Claude iterates on the branch. Scoped, cost-capped, concurrency-gated.

### Changed
- **Bumped CI actions off deprecated Node 20 runtime** ([#43](https://github.com/Sethmr/peanut.gallery/pull/43)). `actions/github-script@v7 → v9`, `actions/checkout@v4 → v6`. Removes the Node 20 deprecation warning firing on every workflow run.
- **Refreshed runtime dependencies** ([#44](https://github.com/Sethmr/peanut.gallery/pull/44)). `@anthropic-ai/sdk 0.39 → 0.90`, `react 19.0 → 19.2.5`, `react-dom 19.0 → 19.2.5`, `ws 8.18 → 8.20`.
- **Refreshed dev dependencies** ([#45](https://github.com/Sethmr/peanut.gallery/pull/45)). `typescript 5.7 → 5.9.3`, `@types/* minors`, `postcss 8.4 → 8.5`, `tsx 4.19 → 4.21`, `autoprefixer 10.4 → 10.5`, `tailwindcss 3.4.17 → 3.4.19`, others.
- **Release model rewritten** ([#47](https://github.com/Sethmr/peanut.gallery/pull/47)). `docs/RELEASE.md` now codifies: `feature/* → develop`, `release/vX.Y.Z → main` (branches preserved forever), `hotfix/* → develop → release/* → main`. No more back-merging or direct-to-main hotfixes.
- **Kickoff + reply workflows default to Opus** ([#48](https://github.com/Sethmr/peanut.gallery/pull/48)). Sonnet was an earlier cost-optimization; Seth's ruling: Opus for all code-writing work. `needs-opus` label is now inert.
- **`protect-main-branch.yml` carve-out tightened** ([#48](https://github.com/Sethmr/peanut.gallery/pull/48)). Only `release/*` head branches target main. `develop` and `hotfix/*` no longer allowed — they'd violate the new model.

### Fixed
- (none in this release)

### Removed
- **`actions/github-script` major-version ignore in `dependabot.yml`** ([#43](https://github.com/Sethmr/peanut.gallery/pull/43)). The ignore existed to defer the v7→v9 decision; that decision is made.

### Manual-step-required follow-ups for operators
- Add `LINEAR_WEBHOOK_SECRET` + `GITHUB_DISPATCH_TOKEN` to Railway env. See `docs/GITHUB-MANUAL-STEPS.md § 17`.
- After Railway deploys, create the Linear → webhook endpoint. See same doc.
- Update protected AI-instruction docs to match new branch model — flagged in chat, not editable by Claude without explicit ask. Files: `CLAUDE.md` (lines 78, 80), `docs/AI-GIT-PROTOCOL.md` (line 183), `docs/BOT-TRIAGE-RUBRIC.md` (lines 23, 31), `docs/AI-INSTRUCTIONS-POLICY.md`.

## [1.5.4] — 2026-04-20 — "The Sweep"

A janitorial release layered on top of v1.5.3 "The Cast." No marquee
feature; six tight PRs that make the repo easier to operate, the side
panel nicer to use on assistive tech, and the backend easier to
diagnose when something goes wrong. Safe to ship whenever CWS review
clears v1.5.3.

### Added
- **Screen-reader labels and keyboard-nav focus rings across the
  side panel** (`extension/sidepanel.html` + `extension/sidepanel.js`,
  [#31](https://github.com/Sethmr/peanut.gallery/pull/31)). Icon-only
  buttons (`#errorDismiss`, `#fireBtn`, `#stopBtn`,
  `#settingsToggle`, every `.drawer-section-back`) now carry
  `aria-label`s; their decorative glyphs are `aria-hidden`. Footer
  filter pills (Fact / Dunk / Cue / Bit) track `aria-pressed` in
  lockstep with their visual `.on` state, and each carries an
  `aria-label` that names what the role means. The gallery feed is
  `role="log" aria-live="polite"` so new reactions get announced
  without interrupting. Universal `:focus-visible` ring (2px
  `--stamp` outline) on buttons / selects / pills / pack cards /
  persona bubbles / drawer menu items — keyboard nav is now visible;
  mouse clicks unchanged.
- **Structured logging in `lib/free-tier-limiter.ts`**
  ([#30](https://github.com/Sethmr/peanut.gallery/pull/30)). Four
  JSONL events through the existing `logPipeline`:
  `free_tier_install_seen` (debug), `free_tier_window_rolled` (info),
  `free_tier_quota_denied` (info — the grep-sharp signal when a user
  reports "I got capped"), `free_tier_usage_recorded` (debug).
- **Structured logging in `app/api/personas/route.ts`**
  ([#30](https://github.com/Sethmr/peanut.gallery/pull/30)). Three
  new events around the streaming body:
  `personas_endpoint_start`, `personas_endpoint_complete`,
  `personas_endpoint_error`. Error payload includes the stack and
  request context server-side; the SSE error event sent to the client
  stays minimal (`{ message }` only).

### Removed
- **Legacy `/watch` reference demo + six orphan components**
  ([#29](https://github.com/Sethmr/peanut.gallery/pull/29)). Finishes
  v1.5 ROADMAP step 3 ("clean out the legacy web-app UI"). v1.5.3
  shipped `middleware.ts` that 308-redirects apex → www, which made
  the code unreachable in production; this release deletes it. Gone:
  `app/watch/` (both files), `components/PersonaColumn.tsx`,
  `components/CombinedFeed.tsx`, `components/YouTubePlayer.tsx`,
  `components/ApiKeysModal.tsx`, `components/TranscriptBar.tsx`,
  `components/PersonaIcon.tsx`, `types/youtube.d.ts`, the `/watch`
  entry from `app/sitemap.ts`, the "Open the Reference App"
  marketing section on `app/page.tsx`. Kept: `app/api/*` (extension
  backend), `app/install/`, `app/privacy/`,
  `components/FadeInObserver.tsx` (still used by the landing).
- **`@microsoft/fetch-event-source` dep**
  ([#32](https://github.com/Sethmr/peanut.gallery/pull/32)). Orphan
  after the `/watch` retirement — nothing imports it anymore.

### Changed
- **SEO metadata + JSON-LD + roadmap table refreshed for v1.5.3 "The
  Cast"** ([#28](https://github.com/Sethmr/peanut.gallery/pull/28)).
  Version badge in `README.md` (`1.4 in review → 1.5.3`),
  SoftwareApplication JSON-LD `softwareVersion` (`1.0.6 → 1.5.3`),
  meta description + keywords + OG alt now lead with illustrated
  peanut mascots, INDEX.md "Current version" block, SEO-PLAN
  baseline, CWS listing copy including screenshot captions. Sister
  `peanut.gallery.site` repo picked up the same refresh in its own
  commit.

### Docs
- **`docs/SESSION-NOTES-2026-04-20-autonomous-pass.md`**
  ([#33](https://github.com/Sethmr/peanut.gallery/pull/33)). Hand-off
  document for the six-PR batch shipped while Seth researched the
  Director in parallel.

## [1.5.3] — 2026-04-20 — "The Cast"

First installment of the v1.8 "Peanut Mascots" roadmap pulled forward into the v1.5 line. Each of the 8 personas now has an illustrated SVG peanut mascot with a signature prop, idle-bobbing in the mug row, sitting on the drawer's mute list, and appearing in a new two-card pack chooser that replaces the `<select>` dropdown for swapping between Howard and TWiST. Fact-checker personas also get a narrow war-defense guardrail.

### Added
- **Illustrated peanut mascots for all 8 personas** (`extension/sidepanel.js`). A shared `buildPeanutSVG` helper produces a dumbbell-body peanut (64×64 viewBox, `scale(1.22)` wrapper so the body fills ~85% of the 42px mug) with eyes, mouth, shell grooves, a specular highlight, and a ground shadow; each persona contributes its own prop + (optional) body gradient override via `bodyStops` / `bodyStroke` / `eyesLight`. Howard: Baba Booey's wooden clipboard with a blue checkmark (smile), the Troll rendered as a **boiled peanut** — dark wet shell, moisture beads, smirk, pop-eye whites, no prop because the state IS the character; Fred's purple DJ headphones wrapped over the upper lobe; Jackie's amber-trimmed vintage stand mic (grin). TWiST: Molly's spiral-bound reporter notebook with blue ruled lines; Jason's red megaphone with sound-wave lines (open yelling mouth); Lon's black-and-white clapperboard with a purple scene tag; Alex's three-slice pie chart, amber dominant. Every mascot carries a 2.4s idle bob that amps to a 0.7s talk-wiggle when the persona is streaming (`.persona-bubble.speaking` state), and a `prefers-reduced-motion` override. `personaMascotHTML(personaId, packId)` returns null for unknown combos so future packs fall back to the initials mug cleanly.
- **Two-card pack chooser** (`#packChooser`, `extension/sidepanel.html` + `.pack-chooser` CSS + `renderPackChooser()` in `sidepanel.js`). Replaces the `<select id="packSelect">` dropdown in the drawer's Lineup section with two tappable pack cards, each showing that pack's 4 peanut mascots + pack name + ACTIVE/TAP TO SWITCH label. Active card gets a stamp-red 2px border (with compensating padding so layout doesn't shift). Clicking the inactive card mirrors the choice into a still-present-but-hidden `<select>` and dispatches `'change'`, so the existing change-handler cascade (buildPersonaAvatars, renderMutesList, updateTracePackLabel, persist) runs unchanged. Grid greys out via `.locked` during capture, mirroring the old select's `disabled` behavior.
- **Mascot thumbnails in the mute-a-critic list** (`.mute-row .av.has-mascot`). 26px mascot rendered inside each mute row in place of the block-letter initials; gives the mute UI its own identity and matches the main mug row.
- **`buildPeanutSVG` shared helper** supports `bodyStops`, `bodyStroke`, and `eyesLight` overrides so a persona can swap just its shell color (the Troll uses all three for the boiled palette) without forking the whole body path, and switch to white-sclera pop-eyes where dark-on-dark would wash out.

### Changed
- **React + Stop buttons tightened during capture** — scoped `#controlsRow .btn` rule brings padding from `10px 14px → 6px 12px` and font-size from `12px → 11px` so the in-session controls don't compete with the persona row for weight. Setup-screen Start button unchanged.
- **React button leading glyph** — ⚔️ swapped to the same `■` Stop uses, so the two buttons read as a matched pair rather than two different icon languages.
- **Masthead title-row bottom padding** 8px → 4px so "THE PEANUT GALLERY" sits tighter against the BROADSHEET subrail.
- **Fact-checker personas: War / military conflict restraint** (`lib/packs/howard/personas.ts` + `lib/packs/twist/personas.ts`). New **WAR / MILITARY CONFLICT RESTRAINT** section on both Baba Booey and Molly: they verify casualty numbers, dates, roles, and public statements with **explicit attribution** ("per the IDF…", "per Hamas's health ministry…", "per the UN…"), but never adopt one side's framing as neutral fact, and PASS with `-` when the only available fact-check requires endorsing a combatant's narrative. Scoped to active wars (Gaza, Ukraine, future conflicts); other politics — elections, immigration, climate, culture — remain normal fact-check territory, and Molly's `CLIMATE ANGLE` line is explicitly preserved. Triggered by user feedback on a Gaza fact-check that read as pro-Palestinian advocacy rather than journalism; the narrower war-only scope is Seth's call after the first broader draft overreached.

### Removed
- **Duplicate episode card** (`#episodeCard` + the `.episode-card*` subtree in both HTML and CSS). The card sat between the status strip and the captured-tab banner, showing the same tab title as the banner below it — two bits of UI doing the same job. Removed the card; free-tier numeric timer still ticks in the status strip, only the progress-fill bar that was inside the removed card went with it. All JS references (`episodeCard`, `episodeCardTitle`, `episodeCardSub`, `episodeCardProgressFill`) are null-guarded, so free-tier timing logic no-ops cleanly without the DOM node.

## [1.5.2] — 2026-04-20 — "First Run"

A small onboarding release on top of v1.5.1's settings drawer. First-time users now get a four-step Editor's Note walkthrough the moment they open the side panel — Welcome → Lineup → Backend & keys → Audio — with a spotlight ring pulsing over the current step's target element and a single Skip/Next path. A "Replay settings tour" row in the Appearance submenu lets anyone re-run it later.

### Added
- **First-run tutorial overlay** (`extension/sidepanel.html` + `extension/sidepanel.js`). `#tutorialOverlay` carries an Editor's Note card (stamp-red slug + step counter + title + body + Skip/Next) and dims the panel via a backdrop at `z-index: 40` (above the drawer's 30). Four steps declared in `TUTORIAL_STEPS`: (1) masthead ⚙ — welcome; (2) Lineup tile — pack + cadence; (3) Backend & keys tile — free tier + BYOK; (4) Audio tile — passthrough gotcha + replay-anytime hint. Each step's `onEnter` flips the drawer to the right state (opens it + resets to menu view) so the spotlight always aims at something visible; `requestAnimationFrame` defers the `.tut-target` class by one paint so the target has rendered into the flow before we highlight it.
- **Spotlight pulse** — `.tut-target` gets a 3px stamp-red outline that animates between `--stamp` and `--yellow` on a 1.6s loop. `outline-offset: 3px` keeps it from shifting layout; `pointer-events: none` on the target prevents mid-tour clicks from desyncing the card from what's actually open. `prefers-reduced-motion` disables the animation but keeps the outline.
- **"Replay settings tour" row in Appearance** (`#replayTutorialBtn`). Closes the drawer first, then `requestAnimationFrame(startTutorial)` so the drawer's `display: none` has committed before step 1's scroll-into-view math runs on the masthead gear.
- **`tutorialSeen` flag** in `chrome.storage.local`. Single-field write on tour end (same pattern as `applyTheme` / `toggleMute` — avoids racing `loadSettings` and wiping empty key inputs). `maybeStartTutorial()` reads the flag independently of `loadSettings` and starts the tour after a 600 ms delay so the empty-state paint has landed first.

### Fixed
- **WIRE QUIET empty state invisible on first panel load.** `#emptyState` carried an inline `style="display:none;"` that won out over its CSS default (`display: flex`); boot flow didn't touch the empty state, so on first load the element stayed hidden until the user ran a start → stop cycle. Dropped the inline style — CSS default is the correct first-load state ([#19](https://github.com/Sethmr/peanut.gallery/pull/19), landed on `develop` after the v1.5.1 release PR cut; rides with v1.5.2).
- **Roadmap / INDEX docs** refreshed to reflect v1.5.1's merge to `main` via PR [#18](https://github.com/Sethmr/peanut.gallery/pull/18) and v1.5.2's tutorial as the new in-flight release.

## [1.5.1] — 2026-04-19 — "Broadsheet Final"

Polish round on top of v1.5's newspaper rebrand. The panel now reads like the proof sheet at [peanutgallery.live/panel/](https://www.peanutgallery.live/panel/): round persona mugs with category-colored borders, per-mug mini waveforms that animate only when that critic is speaking, an ON AIR label strip with its own waveform above the transcript, a 15-minute free-tier timer with a CAP REACHED state, and an episode card that shows the captured tab's title + free-tier progress bar. Settings moved out of the setup view into a 6-submenu drawer reachable from a masthead ⚙. The transcript ticker now scrolls continuously via a rolling-window speech-rate filter instead of per-Deepgram-interim CSS transitions.

### Added
- **Settings drawer with 6 submenus** — Lineup, Backend & keys, Audio, Critics (mute), Export, Appearance. Accessible via a new masthead gear (visible in all states) plus the existing footer gear (visible during capture). Drawer opens in a toc-style menu view; tapping a tile enters a section panel with a `‹ Menu` back button. All existing setting IDs preserved, zero storage wiring changes.
- **Free-tier status strip** — two-line grid under the masthead with colored dot + uppercase state + right-justified `00:00:00` mono timer + state tag + tab-title detail. Only renders when the user has NOT entered their own Deepgram + Anthropic + xAI keys (Brave remains optional, xAI Live Search is the fallback). Ticks at 1Hz from capture start; flips to `CAP REACHED / PAUSED / Daily free minutes exhausted · resets at midnight` when the server emits `TRIAL_EXHAUSTED` or the local clock hits 15:00.
- **Episode card above persona row** — bold slab title (captured tab title, ellipsized) + mono subtitle (hostname, `www.` stripped) + optional 3px progress bar for free-tier users tracking the 15-min cap.
- **ON AIR waveform** — 10-bar horizontal waveform between the `On Air` label and the ticker text. Staggered `-0.05s…-0.60s` animation delays + mixed paper/stamp/yellow bar colors match the proof's `.sp-wave` rhythm. Honors `prefers-reduced-motion`.
- **Per-mug 5-bar waveform** — under each persona circle's name/role. Dotted baseline at rest; stamp-red animated pulse when the bubble carries `.speaking`. Staggered per-bar animation delays.
- **Community pack-contribution issue** ([#16](https://github.com/Sethmr/peanut.gallery/issues/16)) — zero-code on-ramp at the top (one-line CTA to the `pack_request.yml` template); 7-step PR checklist below for coders; links to `lib/packs/INDEX.md` + `lib/packs/twist/personas.ts` as the copy-paste starting point. Labeled `good first issue` + `help wanted` + `enhancement`.
- **`dependencies` and `area: ci` repo labels** — created so Dependabot stops complaining they're missing.

### Changed
- **Persona mugs: 40×40 diagonal-stripe squares → 42×42 round circles** with category-colored borders/fills (fact → stamp outline, dunk → yellow fill, cue → ink outline, bit → ink fill). Matches the `.sp-item` tag palette in the proof. Speaking-state ring is round too (`border-radius: 50%`, `inset: -4px`).
- **Transcript ticker scroll** is now a 60fps rAF loop driven by a 2.5-second rolling-window measurement of the target's growth rate, not per-update CSS transitions. Smoothed speed keeps up with speech pace on average while each Deepgram interim no longer visibly yanks the scroll. Four tunables at the top of the block (`WINDOW_MS`, `CATCHUP_THRESHOLD`, `CATCHUP_RATE`, `MIN_DRIFT_SPEED`).
- **Transcript section is now a 3-col grid** (`On Air` label | 10-bar waveform | flowing ticker). Dark ink bg, paper text, single-line with `white-space: nowrap + text-overflow: ellipsis`. Replaces the multi-line `max-height: 90px` card.
- **Feed entry layout**: timestamp on row 1, tag on row 2, message spans both rows on the right — gives long bodies real width instead of pinching them against a small left column.
- **Filter pills** keep their category color in BOTH on/off states; deselected pills get a diagonal `::after` strike-through at 55% opacity. "All" master pill removed — per-category toggles were already enough.
- **Masthead subrail** text: `Howard | "Four critics. One tab." | Wire` → `Broadsheet | "Four critics. One tab." | Daily`. No pack or person names on the masthead; pack identity still lives in the selector dropdown + feed's persona names.
- **Muted persona mug strike-through** now renders at full contrast (was ghosted because parent opacity inherited to the `::before` pseudo). Fade moved onto the avatar/name/role children; slash kept on the parent at `z-index: 3` with `isolation: isolate` on the bubble.
- **Install page "What is Peanut Gallery?"** paragraph now mentions both shipping packs + links to the pack-authoring guide.
- **CONTEXT.md § UI Design** now names three design surfaces (extension side panel, landing, legacy /watch) with their canonical sources instead of duplicating a single-system palette.

### Fixed
- **Status-bar dot stuck yellow for recorded videos.** Dot only flipped to `.live` (red) when yt-dlp's `is_live` detection said the source was a YouTube live stream; recorded videos left it in `.active` (yellow) for the whole session. Now flips to `.live` on first transcript arrival — "live" in the UI means "transcription is flowing," not strictly "YouTube live stream."
- **Transcript ticker rendering below the ON AIR label** instead of inline to its right. `showCapturing` was setting `transcriptSection.style.display = 'block'` which overrode the CSS grid; now sets `'grid'`.
- **Muted critic bubble strike-through invisible** (see Changed).
- **Filter pills losing their color on deselection** instead of getting a strike-through (see Changed).
- **DUNK tag / REACT button / DUNK pill** went ivory-on-yellow in night mode because `var(--ink)` flips to `#efe7d0`. Switched to `var(--p-ink)` (locked `#111111`) on yellow-backgrounded elements.
- **Cue/Bit filter pills were visually identical** — both rendered via the generic `.pill.on`. Added `.cue` / `.bit` category classes to the HTML + per-category rules (cue = paper bg + 2px ink outline, bit = solid ink fill).
- **Dead references cleaned up**: `packBadgeEl` + `updatePackBadge()` (element was removed from HTML in an earlier commit, null-noop function lingered); `id="responseRateRow"` (unused wrapper ID); stale comments referencing the pre-refactor drawer contents + "v1.4 tabloid rebrand" date stamp; dead `.keys-section` / `.audio-section` / `.toggle-keys` CSS.

### Release / repo
- **TWiST Oracle plan privatized.** Reduced `docs/TWIST-ORACLE-PLAN.md` from a 686-line public roadmap plan to a 47-line private exploratory note; removed its references from `docs/INDEX.md` (it was flagged as "v1.7 working spec" based on Jason's off-hand group-chat riff, which wasn't a commitment).
- **Dependabot ignore rules** added for framework-tier majors (`next`, `react`, `@types/react*`, `typescript`, `eslint*`, `@eslint/*`, `tailwindcss`, `@anthropic-ai/*`, `@types/node`, `actions/github-script`) — closed 7 drive-by Dependabot PRs per the bot-triage rubric's QUEUE-AND-CLOSE verdict.
- **`claude-triage.yml` unblocked** — added `id-token: write` to the workflow permissions block. The triage bot was erroring `Could not fetch an OIDC token`; next Dependabot event should trigger a clean triage comment.

## [1.5.0] — 2026-04-19 — "The Broadsheet"

A full aesthetic reinvention. The side panel is no longer a chat app — it's a late-night newspaper desk. Anton slab masthead, cream paper stock, ink-grey rules, four critics in mug shots with role tags (FACT / DUNK / CUE / BIT), and a wire-service feed where every quip lands with a 24h timestamp and a stamped role tag. Underneath the redesign: a Paper/Night theme toggle for late-session eyes, per-critic mute, and a one-click "Download Session" that ships the whole broadcast as Markdown. Smart Director v2's client-side scaffolding is in — the rule vs. LLM source badge is wired and ready — but the server flag stays off until the canary bands land.

### Added
- **URL transition readiness (Path 2 wiring).** In lockstep with moving the marketing site to GitHub Pages, the backend is moving from the apex (`peanutgallery.live`) to the api. subdomain (`api.peanutgallery.live`). v1.5 ships the extension side of that move: `manifest.json` `host_permissions` now covers the old apex + the new api subdomain + `www.`; the side-panel's default `serverUrl` is `https://api.peanutgallery.live`; `content_scripts` matches `www.` in addition to the legacy apex so the "already installed" pill keeps working on whichever host serves marketing at a given time. A one-shot migration in `background.js` (`migrateServerUrl`, gated on `details.reason === "update"`) rewrites stored `serverUrl === "https://peanutgallery.live"` → `"https://api.peanutgallery.live"` — but only for the literal old default, so self-hosters and custom URLs are left alone. `isHostedBackend` in `sidepanel.js` updated to match both old-apex + api + www so the keys-optional path keeps working across the rollout window.
- **Tabloid / newsprint rebrand of the side panel** (`sidepanel.html`, ~1300 lines). Anton + Source Serif 4 + Special Elite + JetBrains Mono from Google Fonts; `--paper` / `--ink` / `--n-*` token sets scoped via `body[data-theme="paper|night"]`; masthead carries `Vol. I · No. 001` + version badge + SVG title + pack nameplate. Empty state is a "Wire Quiet" wire-service slug, not a chat placeholder.
- **Mug-row critic avatars with role tags.** Each persona renders as initials + a glyph-overlay corner crest colored by pack; role tag underneath (fact/dunk/cue/bit) comes from a new `ROLE_FOR_SLOT` map so the newspaper language is slot-driven, not pack-driven. All existing firing / force-react / director-trace paths keep working against the same element IDs.
- **Wire-service feed with role-tagged rows.** `.feed-entry` is a three-column grid (ts / role stamp / message). Zero-padded 24h `HH:MM` timestamps so the time column is locale-stable. Footer carries filter pills (ALL / FACT / DUNK / CUE / BIT) that hide rows via CSS data attributes on `#gallery` — O(1) regardless of feed length.
- **Paper ↔ Night theme toggle.** Full-screen settings drawer (accessible via footer gear mid-capture) flips `body.dataset.theme` and persists the choice as a single field in `chrome.storage.local`, race-safe against `loadSettings` so it never clobbers API keys.
- **Mute-a-critic.** Per-persona toggles in the drawer. Muted critics get a strike-through on the mug and their stream entries are suppressed client-side — SSE handlers short-circuit on `mutedPersonas.has(pid)`. No server-side change; purely client-side v1.
- **Download Session as Markdown.** Copy-to-clipboard AND download-as-`.md` handlers build a single document with session metadata, the transcript, and every persona quip tagged by role. Export is one click and needs no server round-trip.
- **Smart Director v2 client scaffolding** — `RULE` / `LLM` source badge wired on every decision-trace row; reads `source` off `director_decision` SSE payloads; ready for the server flag to flip.

### Changed
- **`sidepanel.js` reorganized** (~1900 lines) around the new structure: `ROLE_FOR_SLOT`, `personaInitials`, `packBadgeName`, `buildPersonaAvatars`, `addFeedEntry`/`updateStreamingEntry`, `renderMutesList` / `toggleMute`, `applyTheme`, `buildSessionMarkdown`. All SSE handlers untouched at the network layer; only rendering targets changed.
- **Time format** switched from locale 12h to zero-padded 24h `HH:MM` so the feed timestamp column is a fixed width across locales.
- **Settings persistence** uses `chrome.storage.local.set({ field })` single-field writes for theme and mutes (avoids `saveSettings()`'s full read-form-write round trip, which would wipe API keys if `loadSettings` hadn't completed).

### Fixed
- **Feed entries rendered horizontally instead of stacking.** `.gallery` gets `display: flex` inline from the JS capture-start path but the CSS rule was missing `flex-direction: column`, so entries flowed as a row. Added the direction declaration; entries now stack top-to-bottom as intended.

### Deferred (still in [Unreleased] below)
- **Smart Director v2 server flip** — client scaffolding ships in 1.5.0; the 48h hosted canary with `ENABLE_SMART_DIRECTOR=true` is still the gate before flipping the server flag. Bands per `docs/V1.5-PLAN.md §4`. If/when bands clear → tag 1.5.1 (or 1.6 depending on scope at the time).

### Added — v1.5 "Smart Director v2" (feature-complete; canary-pending)
- **`lib/director-llm.ts` — `pickPersonaLLM(ctx)` routing module.** Claude Haiku routing call with a JSON-only response shape (`{ personaId, rationale }`), input validation against the 4 archetype slot ids, and graceful null-return on timeout / upstream error / malformed output. Never throws. Logs structured `llm_director_pick` / `llm_director_timeout` / `llm_director_error` / `llm_director_parse_fail` events for observability.
- **`Director.decide(..., opts?: { llmPick })`.** The rule-based scorer still runs every tick; when `opts.llmPick` is present and names a valid archetype, the chosen persona is hoisted to primary and cascade/cooldown/recency bookkeeping proceeds unchanged. `TriggerDecision.source` is now `"rule" | "llm"` so the v1.2 debug panel can badge each decision card. LLM rationale flows into `decision.reason` as `"LLM routing: <rationale> (rule scorer: <fallback>)"`.
- **`ENABLE_SMART_DIRECTOR` env flag + 400ms race in `/api/transcribe`.** When the flag is on AND an Anthropic key is available for the session, the route races `pickPersonaLLM` against `AbortSignal.timeout(400)` before handing the result (or null on timeout) into `director.decide`. `director_decision` SSE payloads now carry `source` so clients can render the difference. Emits a new `director_v2_compare` pipeline event every tick with agreement/override booleans + `llmElapsedMs` for canary telemetry.
- **`Persona.directorHint?` field** on every persona. ~15-token routing hint surfaced in the Smart Director prompt so the LLM routes with intimate knowledge of each voice's specialty (e.g. Jason Calacanis: *"Confident takes on founder-market fit; cap-table + deal-structure angles. Warm, never mean."*). All 8 shipping personas (Howard + TWiST) now carry hints; `directorHint` omission still works — router falls back to `role`. Optional, documented in `docs/SELF-HOST-INSTALL.md` §8 + `docs/BUILD-YOUR-OWN-BACKEND.md` §9.
- **Side-panel `RULE` / `LLM` source badge** on every decision-trace row in the debug panel. Surfaces LLM rationale when present. Makes canary review a visual scan rather than a log grep.
- **Director test harness extensions.** `DirectorFixture.input.llmPick` lets fixtures inject a synthetic LLM pick without a live provider call. New strict assertion `sourceIn: ["rule" | "llm"]`. Three new fixtures — `llm-override-troll-to-joker` (LLM pick overrides rule-based primary), `llm-unknown-id-falls-back` (unknown archetype id silently degrades to rule-based), and `llm-agrees-with-rule` (router and rule scorer pick the same slot; source stays `"llm"`). Suite is now 17 fixtures × 50 runs.
- **`docs/V1.5-PLAN.md`** — canonical rollout checklist: scaffold, harness, canary metrics, tag gate. §4 defines the four roll-up bands that gate the v1.5.0 tag.
- **`docs/STATE-OF-PRODUCT-2026-04-18.md`** (new) — entry-point memo for sessions resuming after 2026-04-18. TL;DR of current version, uncommitted tree, canary gate, 9-subsystem health check, known risks ordered by severity, per-release value framing.
- **`docs/ROADMAP.md`** — full rewrite. Near-term releases fleshed out with concrete sub-steps: v1.5.1 Smart Director Polish (canary codification + per-pack hint weighting), v1.6 Voice + Clip Share (TTS provider bake-off + client-side clip render), v1.7 Pack Lab (visual pack authoring + All-In / Acquired / Lex gallery), v1.8 Live Moments (danmaku overlay + event triggers + personal context). v2.0 3D Bobbleheads stays vision-level.
- **`marketing/cws-listing.md` + `SHIP.md`** — TWiST pack called out in the CWS long description, podcast-first positioning (per `docs/COMPETITIVE-LANDSCAPE-2026-04-18.md`), tightened screenshot captions, five additional search-term slots. Scrubbed the last stale Groq reference.
- **Narrated v1.5 walkthrough video** — https://youtu.be/WPyknI7-N5U. Seth walks through the LLM-assisted router, the 400ms race, the rule-based fallback, and what changed since v1.4. Embedded on the landing page at `#walkthrough`, surfaced as a `VideoObject` in `app/layout.tsx` JSON-LD, and linked from `README.md` + `docs/ROADMAP.md`.

### Blocking v1.5.0 GA (not code, empirical)
- **48h hosted canary with `ENABLE_SMART_DIRECTOR=true`.** Per `docs/V1.5-PLAN.md §4`: agreement rate ≥ 0.55, override rate 0.20–0.45, p95 `llmElapsedMs` < 350 ms, timeout rate < 0.05. If all four bands hit → bump `manifest.json` to 1.5.0, tag, push. If any miss → do not tag; iterate prompt or pull the feature. Kill switch: flip `ENABLE_SMART_DIRECTOR=false` and redeploy.

## [1.4.0] — 2026-04-18 — "Grok & Stability"

A provider swap, a new search option, and the stability pass that made v1.3 shippable in real-world sessions. Groq's free-tier TPD cap was silently killing the Troll and Lon — both are now on xAI Grok 4.1 Fast. Fact-checking gains a second engine (xAI Live Search) behind a user-facing toggle. Underneath, the biggest story is invisible: the session-firing loop now survives any upstream hang, so one stalled LLM stream can't strand the avatar spinners for the rest of the session. No breaking changes — existing installs just need to add an xAI key (Brave stays optional).

> **Note on the version number.** The original roadmap had v1.4.0 penciled in for Smart Director v2 (LLM-assisted routing). That work is now deferred to v1.5 — the stability fixes in this release were blocking for real-world v1.3 usage and warranted a minor bump of their own rather than sitting in a long-lived Unreleased limbo.

### Added
- **Search-engine toggle (Brave ↔ xAI Live Search).** New `SEARCH_ENGINE` env var (`brave` default, `xai` alternative) + `X-Search-Engine` header forwarded from the extension. The server routes Producer's fact-check queries through Brave's REST API (raw SERP entries, unchanged v1.3 behavior) OR xAI's Grok Live Search (synthesized answer with inline citations via `search_parameters.mode=on`, `sources=[web]`, `max_search_results=5`, `return_citations=true`). Side-panel setup now exposes the dropdown; Brave's key field becomes optional when xAI is selected.
- **xAI as first-class LLM provider.** New `"xai-grok-4-fast"` alias on `Persona["model"]`. PersonaEngine gained a private `streamXai` async generator (fetch-based OpenAI-compatible SSE, partial-line buffering, `[DONE]` sentinel, malformed-chunk skip, `finally`-cleanup). `xaiKey` constructor arg is wired through `/api/transcribe` + `/api/personas` + `scripts/test-personas.ts`, reading `X-XAI-Key` header first and falling back to `XAI_API_KEY` env.
- **Pipeline logging for every value-reducing branch in fact-check search.** New structured events: `search_skip` (force-react path skips search for latency), `search_no_claims_detected` (claim-extraction heuristics found nothing), `search_timeout` (per-engine AbortSignal fired), `search_upstream_error` (non-2xx or thrown fetch error), `search_empty_result` (upstream returned 200 but no usable data), `search_complete` (aggregate outcome with `attempted`/`succeeded`/`emptyOrFailed`/`degraded` flag), and `search_pipeline_error` (outer-catch replaces a previously silent `catch{}`). Observable via the existing `logPipeline` channel.

### Changed
- **Troll + Sound FX personas migrated from Groq Llama to xAI Grok 4.1 Fast non-reasoning** (both Howard and TWiST packs). Root cause was the Groq free-tier TPD cap on `llama-3.3-70b-versatile` silently returning 429s that read as "persona declined to speak." Anthropic Claude Haiku still powers the Producer + Joker slots (Baba Booey, Jackie, Molly, Alex) — those were never affected.
- **Baba Booey force-react tap now skips pre-stream search entirely.** A tap commits Baba to speak, and the search round-trip was the single biggest source of latency before any bubble appeared. Search still runs for director-driven cascades where the budget allows it.
- **"Free" label in the extension side panel now reads "15 minutes free"** to match the rolling 24h limiter's actual quota (was a generic "Free" previously, which read as unlimited).

### Fixed
- **Session-firing deadlock when any upstream hangs.** `/api/transcribe` had a per-session `personasFiring` boolean with no try/finally around the `fireSingle`/`fireAll` await. A stalled Anthropic stream, a stalled xAI stream, or a stuck Brave fetch would leave the flag pinned at `true` forever — killing every subsequent director tick AND every avatar tap on that session until page reload. Root cause behind the v1.4-preview regression where Baba's avatar animated without responding, then stopped showing a spinner on tap entirely. Fix is layered: (1) Anthropic `messages.stream` now carries `{ signal: AbortSignal.timeout(25_000) }`; (2) `streamXai` accepts an `AbortSignal` and plumbs it into both the initial fetch and its reader loop; (3) both firing branches in the setInterval tick are wrapped in `try { … } finally { personasFiring = false; send("personas_complete") }` so ANY throw or timeout releases the lock.
- **Search fetches can no longer hang forever.** Node's native `fetch()` has no default timeout; a silently-stalled Brave or xAI response used to block `fireSingle` for the 15s client safety timeout and beyond. Both `searchBrave` and `searchXai` now use `AbortSignal.timeout(5_000)` / `AbortSignal.timeout(8_000)` respectively. Timeouts emit a distinct `search_timeout` event separate from upstream errors so ops dashboards can tell "slow upstream" from "upstream error."
- **Force-react silent-spin edge cases.** When the Producer bowed out with an explicit `-` pass on a force-react tap, the user would see a spinner that cleared with no bubble. `firePersona` now routes force-react upstream errors AND model-initiated dash-passes through the same deterministic in-voice fallback (`getForceReactFallback`) so tapping an avatar always produces a visible response. Observable via new `force_react_fallback` event.
- **StreamCallback dropping one-shot `text + done=true` payloads.** Error-path bubbles (`[technical difficulties]`) were emitted with `done=true` in a single callback, and the client only renders from buffered `persona` events — so the text never made it to the DOM. Route now splits into a `persona` event (carrying the text) followed by `persona_done`.
- **Extension side-panel API Keys section now scrolls** when content overflows (adding xAI to the four-field form was enough to push the footer's Save button off-screen on shorter viewports). `.setup` gained `min-height: 0; overflow-y: auto;` and a 4px scrollbar skin.
- **Broken peanut emoji in two extension error strings.** `background.js` and `offscreen.js` error messages referencing the toolbar icon were mangling the 4-byte UTF-8 codepoint through `chrome.runtime.sendMessage → textContent` into gibberish. Swapped the emoji for the word "peanut" in both strings (static HTML emojis in the header/empty-state render fine and were left alone).

### Removed
- **`groq-sdk` dependency** dropped from `package.json` and all references scrubbed from `lib/persona-engine.ts`, `lib/personas.ts`, `app/api/transcribe/route.ts`, `app/api/personas/route.ts`, and `scripts/test-personas.ts`. No runtime code path references Groq anymore. Historical references (CHANGELOG entries, session notes, in-code comments explaining WHY Groq was removed) are intentionally retained.

### Docs + marketing
- README, landing page (`app/page.tsx`), `/install`, `/watch`, `/privacy`, `components/ApiKeysModal.tsx`, `docs/index.html`, `marketing/cws-listing.md`, `setup.sh`, `lib/packs/types.ts`, `docs/SELF-HOST-INSTALL.md`, `docs/BUILD-YOUR-OWN-BACKEND.md`, `docs/DEBUGGING.md`, `docs/CONTEXT.md`, `docs/OPS.md`, `docs/SERVER-SIDE-DEMO-KEYS.md`, and `SHIP.md` all updated to reflect the xAI requirement, the optional Brave key, and the new search-engine toggle.

### Deferred to a future release
- **Smart Director v2** (rerouted to v1.5). LLM-assisted routing with a rule-based fallback under a 400ms budget. Scoped out of v1.4 so this release could focus on the stability + provider story.
- **Pack-creation installer** (still targeting v1.4.x / v1.5). Sideload pack JSON, validation pipeline, pack management UI.
- **Cascade-delay retune** (carried over from v1.2). Still waiting on two real-session captures.
- **ESLint migration** to flat-config CLI (carried over from v1.3).

### Future roadmap (post-v1.4.0)
- **v1.5.0 — Smart Director v2:** LLM-assisted routing with rule-based fallback under a 400ms budget.
- **v1.6.0 — Voice + Clip Share:** TTS per persona; highlight/clip export.
- **v2.0.0 — Bobbleheads:** 3D persona avatars with procedural animation.

## [1.3.0] — 2026-04-17 — "TWiST Pack"

The flagship feature: **selectable persona packs.** Keep riding with the Howard crew, or swap in the This Week in Startups lineup — Molly Wood, Jason Calacanis, Lon Harris, Alex Wilhelm — with a single dropdown. Pack choice persists across sessions; the Director is pack-agnostic (same archetype slot ids, same behavior) so routing stays identical regardless of who's on the roster. Fully wire-compatible with v1.2.x backends: an unknown pack id gracefully degrades to Howard server-side via `resolvePack()`, so an older server + newer client still works.

### Added
- **Pack abstraction** (`lib/packs/`). New `Pack` type + `resolvePack(id)` helper that never throws — unknown / missing / malformed ids always resolve to Howard. Single choke point means the forward-compat matrix (new client + old server, old client + new server, mismatched packs) always degrades cleanly. `PersonaEngine` now takes an optional `pack` in its constructor; legacy call sites that don't pass one continue to get Howard via a back-compat shim (`lib/personas.ts` re-exports `howardPersonas as personas`).
- **Howard pack** (`lib/packs/howard/`). Pre-existing Baba Booey / Troll / Fred / Jackie personas extracted from `lib/personas.ts` into `lib/packs/howard/personas.ts` with zero content changes. Back-compat shim keeps all v1.2 import sites unchanged.
- **TWiST pack** (`lib/packs/twist/`). Four new personas, each researched from public TWiST transcripts and episode clips and mapped to the four archetype slots:
  - **Molly Wood** → `producer` (Fact-Checker). Claude Haiku + Brave. Calm journalistic corrections, "according to" framing, receipts-first.
  - **Jason Calacanis** → `troll` (Provocateur). Groq Llama 70B. Confident takes, founder-market-fit framing, warm-not-mean, self-aware self-promotion as character fingerprint.
  - **Lon Harris** → `soundfx` (The Reframe). Groq Llama 8B. Bracket-delimited sound cues + cultural analogies as primary languages. Reacts to moments, never monologues.
  - **Alex Wilhelm** → `joker` (Data Comedian). Claude Haiku. Eight joke techniques (NUMBER-AS-PUNCH, COMP-BOMB, BACK-OUT-THE-THING, …) built on data + absurdity.
  - All four include explicit anti-impersonation guardrails: "NEVER claim to BE [person]. You are a persona INSPIRED BY him." See [`docs/packs/twist/RESEARCH.md`](docs/packs/twist/RESEARCH.md) for the characterization source.
- **Pack selector dropdown** in the side-panel setup section. Always-visible at the top so first-time users understand the choice; persists across sessions via `chrome.storage.local`. Hint text tells users the change takes effect on the next Start Listening (no mid-session swap, for the same reasons as the rate dial).
- **Director trace pack label.** The debug panel (long-press version badge) now shows a `pack: <id>` tag in its header. Muted when idle — reflects the dropdown's pre-session selection. Tinted accent + `locked` state when a session is live — reflects the pack that actually produced the rows you're reading. Prevents the "dropdown drifted mid-session" confusion surface.
- **Four TWiST-flavored fixtures** under `scripts/fixtures/director/twist-*.json` exercising each archetype slot with TWiST vocabulary (cap tables, Series A/B/C, Anthropic, Databricks, a16z / Sequoia name-drops). Same assertions shape as the Howard fixtures — pack-agnostic Director means these validate the same code path with different transcripts.

### Changed
- **`/api/transcribe` + `/api/personas`** now parse an optional `packId` from the request body and pass the resolved pack to `new PersonaEngine({ pack })`. Omitted `packId` → Howard, so v1.2 clients (and any third-party backend honoring the spec) keep working untouched. The resolved pack id is written into the `session_create` log line for end-to-end correlation.
- **Extension pipeline** (`sidepanel.js` → `background.js` → `offscreen.js` → `/api/transcribe`) threads `packId` through every hop. Background + offscreen default to `"howard"` on any missing / non-string field so a stale side-panel build can't wedge a backend session.
- **`PERSONAS` global in `sidepanel.js`** is now a Proxy over the active pack's array. All existing call sites (`PERSONAS.find(...)`, `for..of PERSONAS`, `.reduce`, …) work unchanged; pack switches take effect immediately without a refresh. `PERSONA_COLOR_BY_ID` became a lazy `colorForPersonaId(id)` getter for the same reason.
- **`scripts/test-director.ts` gained a `--pack <id>` flag.** Runs the subset of fixtures whose `pack` field matches. Fixtures without a `pack` field default to `"howard"`, so `--pack howard` covers the legacy v1.2 fixtures verbatim. `npm run test:director` with no flag runs all 14 fixtures (10 Howard + 4 TWiST) in one pass.

### Tooling
- **Pre-merge gate now covers extension JS.** New `npm run check:extension` step runs `node --check` across `background.js`, `offscreen.js`, `sidepanel.js`, and `content.js`. Folded into `npm run check` (= `typecheck + check:extension + test:director`) and wired through the husky pre-commit hook. Catches the MV3 extension's plain-JS syntax errors before commit — the extension is intentionally un-bundled so TypeScript wouldn't catch these.
- **`next lint` deferred.** Dropped from `npm run check` due to an eslint-config-next @ Next 15.5 circular-structure bug (`Converting circular structure to JSON` during config load). Will re-enable once we migrate to the ESLint flat-config CLI per Next.js's migration guide.

### Deferred to a future release
- **Pack-creation installer.** v1.3 ships with Howard + TWiST baked in. A proper `pack install` flow (sideload a pack JSON, validate, merge into the dropdown) was scoped out of the flagship and will land in v1.3.1 or v1.4. Adding a pack today still means editing `lib/packs/` and `extension/sidepanel.js::PACKS_CLIENT`.
- **ESLint migration.** Re-wire lint into the pre-merge gate once the flat-config CLI path is stable.
- **Cascade-delay retune** (carried over from v1.2). Still waiting on two real-session captures before retuning `CASCADE_DELAY_MIN_MS` / `MAX_MS`.

### Future roadmap (post-v1.3.0)
- **v1.3.1 — Pack installer:** Sideload pack JSON, validation pipeline, pack management UI.
- **v1.4.0 — Smart Director v2:** LLM-assisted routing with rule-based fallback under a 400ms budget.
- **v1.5.0 — Voice + Clip Share:** TTS per persona; highlight/clip export.
- **v2.0.0 — Bobbleheads:** 3D persona avatars with procedural animation.

## [1.2.0] — 2026-04-17 — "Mise en place"

Observability + pacing + the quality bar. Everything here is additive and wire-compatible with v1.1.x backends, so existing installs keep working if they pin an older server.

### Added
- **Director debug panel** in the side panel. Hidden by default, revealed by long-pressing the version badge for 750ms. Shows the last 20 routing decisions as persona-tinted rows with pick, score, runners-up, cascade length, chain, and reason. Open/closed state persists across side-panel reopens. Short-press does nothing so normal users never see it.
- **New SSE event `director_decision`** emitted once per Director cycle. Payload is backward-compatible: adds `pick`, `score`, `top3`, `chainIds`, `delays`, `cascadeLen`, `cooldownsMs` while preserving the pre-v1.2 fields (`chain`, `reason`, `cascadeCount`, `isSilence`, `drySpells`).
- **Enriched structured logs.** `lib/director.ts` now owns the `director_decision` line at `info+` with the full schema above plus `sessionId` for end-to-end correlation. The duplicate log line in the route is removed.
- **Response-rate dial (1-10)** in the side-panel setup. A smooth exponential pace multiplier (`3^((5-rate)/5)`) scales the first-trigger, trigger-interval, and silence-threshold timings so users can pick the cadence that fits their audience. 1 = laid back (~56k tok/hr), 5 = default (identical to pre-v1.2), 10 = nonstop (~403k tok/hr). Token estimates shown inline in the selector. Forwarded side-panel → background → offscreen → `/api/transcribe`; older clients that omit `rate` fall through to 5 on the backend (zero-behavior-change path).
- **`scripts/test-director.ts` + 10 JSON fixtures** under `scripts/fixtures/director/`. Fixture-driven harness runs each fixture 50× and asserts on distribution (pick-ratios, must-fire-ratios) plus structural invariants (delays monotonic, delays[0] === 0, return-shape complete). Covers the v1.1.1 silence cap, ISSUE-004 shape preservation, ISSUE-006 variance, dry-spell boost, recency penalty, and every persona's primary trigger path.

### Changed
- **Director internal state** now tracks per-persona `lastFiredAt`, seeded at construction so "never fired" reads as "cold since session start" in the debug panel rather than a 54-year-old epoch cooldown.
- **`TranscriptionManager` timing constants** (`FIRST_TRIGGER_MS`, `TRIGGER_INTERVAL_MS`, `SILENCE_THRESHOLD_MS`) are now mutable via a new `setPaceMultiplier(mult)` method with `[0.2, 5.0]` clamping and NaN/Infinity → 1.0 fallback. Default multiplier is 1.0, so pre-v1.2 clients see identical cadence.
- **Route poll tick** in `/api/transcribe` scales with the rate dial but only faster than the 5s default (floor 1s at rate=10). Poll never slows below default because the real trigger gate is already inside `shouldTriggerPersonas()`.

### Tooling
- **Pre-merge gate** via `.husky/pre-commit`: runs `npm run check` (= `tsc --noEmit` + `next lint` + `tsx scripts/test-director.ts`). Bypass with `git commit --no-verify` in emergencies.
- **`npm run typecheck` / `npm run check` / `npm run test:director`** scripts added to `package.json`.
- **`husky`** added as a dev dependency with `prepare` script for automatic install on `npm install`.

### Deferred to a future patch
- **Cascade-delay retune** (`CASCADE_DELAY_MIN_MS` / `MAX_MS` in `lib/director.ts`). Plan called for measuring against two real-session captures (one fast-exchange, one slow) before tuning. Debug panel is now live; the retune will land as a small follow-up PR once the captures are recorded.

### Future roadmap (post-v1.2.0)
- **v1.3.0 — TWiST Pack (flagship):** Selectable persona packs. Shipped — see above.
- **v1.4.0 — Smart Director v2:** LLM-assisted routing with rule-based fallback under a 400ms budget.
- **v1.5.0 — Voice + Clip Share:** TTS per persona; highlight/clip export.
- **v2.0.0 — Bobbleheads:** 3D persona avatars with procedural animation.

## [1.1.2] — 2026-04-17

Patch on top of the 1.1.1 "server-side demo access" feature: put a real, fair cap on the shared backend so one heavy user can't drain the pool, and make the "run it yourself" path obvious everywhere.

### Added
- **Free-tier rate limiter** (`lib/free-tier-limiter.ts`) — per-installation quota for the hosted backend. In-memory, lazy-pruning, singleton-stashed on `globalThis` so hot-reload doesn't wipe it. 15 minutes of transcription per rolling 24h window (both env-overridable via `FREE_TIER_MINUTES` / `FREE_TIER_WINDOW_HOURS`). Completely inert until the operator sets `ENABLE_FREE_TIER_LIMIT=true` — self-hosters and local dev never pay a cost.
- **`X-Install-Id` header** generated by the extension on first launch (`extension/sidepanel.js::ensureInstallId`), persisted in `chrome.storage.local`, sent on every `POST /api/transcribe`. CORS `Access-Control-Allow-Headers` on the transcribe route updated to accept it.
- **402 `TRIAL_EXHAUSTED` response shape** documented in `docs/BUILD-YOUR-OWN-BACKEND.md` as non-negotiable #8 so third-party backends can opt into the same pattern and the official extension will recognize their limits.
- **Build-your-own-backend docs + website callouts.** New `docs/BUILD-YOUR-OWN-BACKEND.md` wire spec (12 sections, 8 curl-based acceptance tests) and `docs/SELF-HOST-INSTALL.md` operator guide. Landing page (`app/page.tsx`) and `/install` page updated with "Build Your Own Backend" sections. README gets a copy-paste prompt you can feed to Claude or Cursor to scaffold a compliant backend.

### Changed
- **Side panel UI** (`extension/sidepanel.html`) — new green "Free to try while we grow" banner at the top of setup. Keys-intro text rewritten to match the new free-tier story: "Keys are optional while we grow… we'll switch to a bring-your-own-key model." Backend-server field hint now links both the self-host guide and the build-your-own spec.
- **Session teardown** (`app/api/transcribe/route.ts`) — sessions now track `startedAt` and a `charged` guard. Elapsed time is recorded against the install's quota on `DELETE`, on `req.signal.abort`, and on the transcriber's `stopped` event. Double-charging is guarded.
- **Key-resolution logic** now distinguishes header-provided from env-provided keys. A session is only rate-limited if the server would actually hand out a demo key for at least one provider — BYO-keys users bypass the limiter entirely.

### UX
- When the hosted backend returns 402 with `code: "TRIAL_EXHAUSTED"`, the side panel auto-opens the API-keys accordion and shows a plain-language message telling the user which key to grab and where. No raw error-banner dump.

### Notes
- Extension version bumped `1.1.1 → 1.1.2` in `extension/manifest.json` and the side-panel footer badge.
- Backend deploy is fully backwards-compatible: until the operator sets `ENABLE_FREE_TIER_LIMIT=true`, the limiter branch is skipped entirely and older extension builds keep working as-is. Recommended rollout: deploy backend with the flag off, publish the extension update, wait 2–3 days for Chrome Web Store auto-update propagation, *then* flip the flag.

## [1.1.1] — 2026-04-17

Quality-of-life polish ahead of the TWiST submission and a security-driven refactor of how the extension handles "demo access."

### Added
- **Silence detection** replaces pause detection (`lib/transcription.ts`, `app/api/transcribe/route.ts`). When the transcript stays empty for 18 seconds the Director fires a one-shot "crickets on the show" moment, cascade-capped at 2 so it doesn't dogpile. Firing resets when new speech arrives. Director + persona prompts forbid the words "pause/paused/pausing" and use "crickets / dead air / silence / nobody's talking" instead, because the viewer didn't pause anything — the show itself went quiet.
- **Force-react button** in the side panel with a pure-CSS loading spinner (no layout shift). One click summons an in-character reaction from the Director's pick; persona prompt forbids the `"-"` pass token so force-fires never no-op.
- **Captured-tab banner** in the side panel. Live-updates on tab switch and title change via `chrome.tabs.onActivated` / `chrome.tabs.onUpdated`. Click the banner to focus the capturing tab (`chrome.tabs.update` + `chrome.windows.update`).
- **Server-side demo access** — see "Changed" and [`docs/SERVER-SIDE-DEMO-KEYS.md`](docs/SERVER-SIDE-DEMO-KEYS.md). First-time users can Start Listening without entering any keys; the hosted backend's env vars cover the providers.
- **Docs**
  - `docs/SERVER-SIDE-DEMO-KEYS.md` — architecture + rationale for the header-first / env-var-fallback pattern.
  - `docs/BUILD-YOUR-OWN-BACKEND.md` — contract for alternative backends (also enables the self-hoster guard).
  - `docs/SELF-HOST-INSTALL.md` — install flow for users running their own Next.js deploy.
  - `docs/SESSION-NOTES-2026-04-17.md` — handoff for the v1.1.1 session (post-compaction rescue + docs pass).

### Changed
- **Extension no longer ships demo API keys.** Key input fields default to empty strings; `extension/offscreen.js` only sets `X-*-Key` headers when the user has pasted a value. The backend (`app/api/transcribe/route.ts`, `app/api/personas/route.ts`) falls back to `process.env.*` when headers are absent. Zero keys in the extension zip, zero keys in `git`. See [`docs/SERVER-SIDE-DEMO-KEYS.md`](docs/SERVER-SIDE-DEMO-KEYS.md).
- **Side-panel copy** updated to reflect the new architecture: "API keys — temporarily optional" instead of "pre-filled / free right now." Copy notes that shared backend access is rate-limited and will be retired.
- **Pre-flight key check** is now conditional on the configured server URL. Against `peanutgallery.live` we skip the client-side check entirely (server env vars cover it). For self-hosters the old behavior applies — Deepgram + Groq + Anthropic are required.

### Fixed
- **ISSUE-009 — GitHub push protection rejected v1.1.1 for embedded demo keys.** An earlier pass at demo access hard-coded four provider keys into `extension/sidepanel.js`. Push was blocked; commits were local only (nothing leaked). Fixed by reset-and-reshape onto the server-side fallback architecture above. Full post-mortem in `docs/DEBUGGING.md`.
- Persona context no longer leaks "pause" wording into silence reactions. `lib/personas.ts::buildPersonaContext` takes an `isSilence` flag (renamed from `isPaused`) and installs a hard rule list of allowed / forbidden phrases.

### Notes
- Extension version bumped `1.1.0 → 1.1.1` in `extension/manifest.json` and in the side-panel footer badge.
- `.commit-msg.txt` added to `.gitignore` — it's a scratch file used when committing multi-line messages via `git commit -F`.

## [1.1.0] — 2026-04-17

Audio-routing QoL for podcasters + persona context rebalance + Chrome extension reliability fixes.

### Added
- **Passthrough toggle + output-device picker** in the side panel. On by default — captured tab audio plays back through your speakers so you hear the video normally. Turn off when OBS / Riverside / BlackHole / VB-Audio is already routing audio, to avoid doubling. Device picker lets you send passthrough to a specific output the recording rig doesn't capture. See `docs/PODCASTER-SETUP.md`.
- **Audio config forwarded through `background.js`** so passthrough + `sinkId` reach the offscreen document cleanly.

### Changed
- **Persona context rebalanced.** The Director now hands each persona a transcript-heavy context (roughly 90% transcript / 10% cross-persona log) so replies ground in what was actually said, not in what the other personas just said. Fixes Baba Booey's tendency to echo his own last fact-check.
- **Troll trigger timing.** Re-tuned cooldown and cascade probability so The Troll engages more often on spicy transcripts without dominating cascades.
- **Persona character depth.** `lib/personas.ts` received richer character models — specific mannerisms, taboo topics, callback patterns — pulled from Howard Stern show research.

### Fixed
- **Silent START_RECORDING failure** — errors from the offscreen document are now propagated back through `background.js` to the side panel, which surfaces them in the error banner instead of hanging on "Connecting to server…"
- **Baba Booey self-repetition** — conversation-context sampler now excludes each persona's own recent messages when building its prompt.
- **Honest UI copy** pass on the side panel — version badge, status copy, and settings descriptions aligned with actual behavior.

### Notes
- v1.1.0 was released alongside v1.1.1; the changelog entries are split here for historical clarity but the Chrome Web Store upload is v1.1.1.

## [1.0.0] — 2026-04-17

First public release. Submitted for the TWiST $5,000 + guest-spot bounty from Jason Calacanis and Lon Harris.

### Added
- **Chrome extension (primary product).** Native Chrome side panel with silent tab audio capture via `chrome.tabCapture.getMediaStreamId`. No screen-share picker, no interference with playback. MV3 service worker + offscreen document pattern.
- **Four AI personas**, modeled on the Howard Stern Show staff and defined in `lib/personas.ts` with deep character research:
  - Baba Booey (Gary Dell'Abate) — fact-checker. Claude Haiku + Brave Search for live web verification.
  - The Cynical Troll — contrarian commentator. Groq Llama 70B, ~120ms time-to-first-token.
  - Fred Norris — sound effects / context. Groq Llama 8B.
  - Jackie Martling — comedy writer. Claude Haiku.
- **Director + cascade trigger model** (`lib/director.ts`). Rule-based booth producer scores the transcript, picks the best persona to fire first, then cascades to others with decreasing probability and staggered delays so some moments get one response and others pile on.
- **Live vs. recorded mode detection** via `yt-dlp --print is_live`. Distinct UI, diarization toggling, low-latency FFmpeg flags, and auto-reconnect for live streams.
- **Pause reactions.** When the viewer pauses, personas react in character instead of going silent (capped at two responses).
- **Cross-persona awareness.** Each persona sees the other three's most recent response and can riff off them. Each persona's last three messages are injected for callbacks and running jokes.
- **Fact-checking pipeline** for Baba Booey. Scores sentences for factual claims (numbers, dates, attributions, rankings), runs parallel Brave Search queries, and injects formatted results into the Producer's context.
- **Audio pipeline (reference web app).** yt-dlp → FFmpeg (`-f s16le`, 16 kHz, mono PCM) → Deepgram Nova-3 via WebSocket with KeepAlive + exponential-backoff reconnect.
- **BYOK flow.** Users supply their own Deepgram / Groq / Anthropic / Brave Search keys through the side panel; keys are stored in `chrome.storage.local` and passed per-session via request headers. Never logged, never persisted server-side.
- **Landing page** at [peanutgallery.live](https://peanutgallery.live) with install flow, cast bios, cost breakdown, and a live demo CTA. Deployed via Railway.
- **Privacy policy** at `/privacy` (`app/privacy/page.tsx`) and sitemap entries for `/privacy` and `/watch`.
- **Structured debug logging** (`lib/debug-logger.ts`) — JSONL at `logs/pipeline-debug.jsonl`, always-on at info+, `DEBUG_PIPELINE=true` adds debug-level.
- **Byte-counter stall detector** in the pipeline with stage-specific diagnostics (yt-dlp / FFmpeg / Deepgram) and UI progress surfacing.
- **Health check endpoint** at `/api/health` — reports API key status and binary availability.
- **Standalone test scripts** — `scripts/test-transcription.ts` and `scripts/test-personas.ts` (with `--fixture` flag for the AstroForge TWiST transcript).
- **Packaging script** `scripts/pack-extension.sh` — zips `extension/` into `releases/peanut-gallery-v<version>.zip` for Chrome Web Store upload.
- **Dockerfile** with `yt-dlp` + `ffmpeg` pre-installed; `railway.toml` for one-shot deploys.
- **Documentation.** `docs/CONTEXT.md` (canonical project context), `docs/INDEX.md` (reading order), `docs/DEBUGGING.md` (post-mortem log ISSUE-001..008 + silent-failure table), `docs/SESSION-NOTES-2026-04-16.md` (immutable permissions guardrails), `SHIP.md` (launch checklist).

### Fixed
- **ISSUE-001 — FFmpeg WAV header poisoning Deepgram.** Changed `-f wav` → `-f s16le` in both `start()` and `restartAudioPipeline()`. The 44-byte RIFF header was being decoded as audio by Deepgram's `linear16` path, producing silence. Single most important fix in the project.
- **ISSUE-002 — Binaries invisible to the Next.js server.** Added a `which()` resolver that checks `/opt/homebrew/bin` and other common paths because Next.js doesn't inherit shell `PATH`.
- **ISSUE-003 — `ws` native deps missing.** Added `bufferutil` and `utf-8-validate` to `package.json`.
- **ISSUE-004 — Force-fire button no-op.** Removed a premature `resetNewTranscript()` call that was clearing the buffer before `forceNextTrigger()` could use it.
- **ISSUE-005 — Deepgram errors silently swallowed.** Added handling for `type === "Error"` and `data.error` in the WebSocket message handler.
- **ISSUE-006 — Personas fire repeatedly while paused.** Gated `shouldFire` on `!session.paused` so only the one-shot "just paused" reaction runs when the viewer pauses.
- **ISSUE-007 — Pipeline silent stall.** Added byte counters, first-bytes indicators, and a 15-second stall detector with stage-specific diagnostics.
- Chrome extension icons missing — toolbar button silently hidden until 16/48/128 PNGs were added to `extension/icons/`.
- `tabCapture` acquisition moved out of the side-panel message handler and into `chrome.action.onClicked` so the user-gesture context is preserved and the stream ID call no longer rejects.
- `STREAM_READY` broadcast added for already-open side panels — otherwise re-clicks after the first open never triggered capture.
- `/app` route renamed to `/watch` to resolve a collision with Next.js's `app/` directory.
- `yt-dlp` headless server support — switched to the `mediaconnect` player client and added a cookies file option to survive bot detection on Railway.
- Dockerfile `public/` `COPY` failure fixed by switching Railway to the Dockerfile builder.

### Notes
- Permissions / gesture setup in `manifest.json` and `background.js` is treated as immutable — see `docs/SESSION-NOTES-2026-04-16.md §3`. Do not re-derive from blog posts.
- `personas.ts` is the creative soul of the project. Preserve the Howard Stern character research in any changes.
- Releases zipped by `scripts/pack-extension.sh` live under `releases/` and are git-ignored from v1.0.0 forward.

[1.0.0]: https://github.com/Sethmr/peanut.gallery/releases/tag/v1.0.0
