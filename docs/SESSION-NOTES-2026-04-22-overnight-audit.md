# Session notes — 2026-04-22 overnight audit + feature prep

Continuation handoff after the "Opus catch-up" on 2026-04-21. Scope: close out Plus Phase 2 + Phase 3, merge the superseding factcheck-hardening PR that had been open on a daemon branch, document the hard-save release of v1.7.0, audit the app + docs, refresh every INDEX, and queue 3–5 creative-feature PRs for Seth to decide on in the morning.

## What landed on `develop` this session (in merge order)

| Commit | Title | Notes |
|---|---|---|
| `30304f6` | **feat(subscription): Phase 2 persistent identity via SQLite (SET-25) (#123)** | `lib/subscription-keys.ts`, `lib/subscription-store.ts`, `scripts/subscription-issue.ts`, 252-assertion test suite. Public API of `lib/subscription.ts` unchanged — Phase-1 env-whitelist preserved as fallback when `SUBSCRIPTION_DB_PATH` is unset. `better-sqlite3` prebuilt binary (no native compile). |
| `462bea1` | **feat(subscription): Phase 3 Stripe integration — real checkout + webhook (SET-26) (#124)** | Real Stripe Checkout Session via `POST /v1/checkout/sessions`. Manual HMAC-SHA256 signature verifier in `lib/stripe-webhook.ts` (no `stripe` npm dep). Full event handlers for `checkout.session.completed` / `customer.subscription.updated` / `customer.subscription.deleted`. US-only at 4 layers; idempotent via `stripe_sub_id`; 21-assertion test suite. |
| `1b66b17` | **feat(factcheck): harden claim pipeline + evidence-gated producer tiers (#125)** | ⚠️ **Reverted** — a less-thorough duplicate of what a daemon had already opened as PR #120. My string-heuristic `evidence-classifier.ts` was superseded by #120's source-of-truth `searchStatus` threading. See commit `e521ff7`. |
| `e521ff7` | **revert: "feat(factcheck): ..." (#125)** | Clean revert so #120 could land cleanly. |
| `d6c0ba7` | **feat(factcheck): harden claim pipeline + evidence-gated producer tiers (#120)** | Supersedes #125. Claim-detector: spoken-number normalizer (`"three billion dollars"` ↔ `"$3B"`), structured attribution, funding-round patterns (Series A-F), compound-claim bonus, mid-sentence proper-noun fix, ASR-splitter fallback. Evidence-gated tiers: `searchStatus: "with_results" \| "empty" \| "skipped"` threaded through `firePersona` → `buildPersonaContext` → `EVIDENCE: GREEN/THIN/NONE` in producer prompts + CoVe-style QUICK SELF-CHECK. Director claim-density boost (+0.5 → +2.0, capped; respects character balance). 62 claim-detector tests, 26 director fixtures. |

## v1.7.0 "The Fine Print" — hard-save artifact (not on develop)

Not merged; preserved as branch + tag on origin:

- `refs/heads/release/v1.7.0` at `b11e43b` (main repo)
- `refs/tags/v1.7.0` (main repo)
- Site sibling repo (`Sethmr/peanut.gallery.site`) has a parallel `release/v1.7.0` branch + tag.

Contains: rewritten Privacy Policy + Terms of Service counsel drafts + `LAWYER-REVIEW-BRIEF.md`, US-only gate across four defense layers, cookie-consent banner on marketing surfaces, Cloudflare Email Routing + Resend (`noreply@send.peanutgallery.live`) plumbing, `docs/SELF-HOST-FOR-INTERNATIONAL-USERS.md`. **Not released to CWS, not merged to main.** PR #121 was opened then closed per Seth's "branch + tag is the artifact, not a PR" clarification.

## Linear state changes

- **Done**: SET-25 (Phase 2), SET-26 (Phase 3 Stripe). Both closed via PRs with full context comments.
- **Retitled**: SET-18 ("Smart Director GA ... v1.8+; slot reclaimed since v1.7.0 shipped as 'The Fine Print'").
- **Commented + returned to Backlog**: SET-19 (blocked on SET-14 canary data + requires Seth-driven audio collection; not a one-session task). SET-26 + SET-30 (briefly moved to In Progress before Seth course-corrected to "don't move tickets to In Progress, that spawns the daemon" — doc'd in memory).
- **Created**: SET-32 International-fork coordination (ambient watch ticket, assigned to seth@manugames.com).

## Audit + hygiene (this session's cleanup branch)

Beyond the feature work above, this session's audit branch (`chore/audit-2026-04-22`) captures:

- Duplicate `isValidEmail()` across checkout + manage routes extracted to new [`lib/http-validation.ts`](../lib/http-validation.ts).
- Duplicate `emailForLog()` likewise extracted + now used by the manage route (previously logging raw emails at 4 sites).
- Marked AUDIT finding E1 (response-rate clamping) as already-resolved in [`docs/AUDIT-2026-04-21.md`](AUDIT-2026-04-21.md) — the route-handler clamp was already shipping, the audit was stale.
- Every INDEX.md (`INDEX.md`, `app/INDEX.md`, `lib/INDEX.md`, `extension/INDEX.md`, `scripts/INDEX.md`) refreshed to reflect post-v1.6.0 develop state. `lib/INDEX.md` gains entries for `subscription-store.ts`, `subscription-keys.ts`, `stripe-webhook.ts`, `http-validation.ts`.

## Known gaps — not touched this session

- **SET-30** legal review — counsel-owned; drafts ready; brief at [`docs/legal/LAWYER-REVIEW-BRIEF.md`](legal/LAWYER-REVIEW-BRIEF.md).
- **SET-14 canary** not enabled on Railway; as a result `director_v3_shadow_compare` event count in `logs/pipeline-debug.jsonl` is 0. Blocks SET-9, SET-16, SET-17 (all documented in `feedback_shadow_data_gap.md` auto-memory).
- **Feedback opt-out toggle** in the Extension drawer (Privacy Policy promise) — not built. See the 3–5 feature PRs below; this may land there.
- **Session-recall "Past sessions" UI** — `session-store.js` groundwork is shipped; the drawer UI is the largest unbuilt v2.0 launch-feature surface. Not attempted overnight (large scope).

## Handoff tomorrow

1. Scan the 3–5 feature PRs queued on branches `feat/<slug>-<N>` against develop.
2. Merge the ones you want; close the ones you don't. Each PR is scoped to one branch + one feature for clean cherry-picking.
3. SET-30 legal brief ready to hand to counsel; nothing else to do until counsel replies.
4. Stripe test-mode smoke is the biggest ops-side unblocker — 15 min following `docs/STRIPE-INTEGRATION.md` + `docs/EMAIL-INTEGRATION.md`.
