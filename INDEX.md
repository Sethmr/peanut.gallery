# Peanut Gallery — Repo Index

Machine-readable map of this repo. If you are an AI resuming work here, read this first.

**Current manifest version:** `v1.6.0` ("The Canary") — the last published `extension/manifest.json` value. The `v1.6.0` tag also marks the "in flight" canary release for Smart Director v3 flag-gated rollout (PR [#91](https://github.com/Sethmr/peanut.gallery/pull/91)) — not yet Chrome-Web-Store distributed as of 2026-04-22.

**v1.7.0 "The Fine Print"** — hard-save branch + tag on origin (`release/v1.7.0`, tag `v1.7.0`). Ships the rewritten ToS/Privacy drafts, US-only gate on Plus, cookie-consent banner, and email-alias plumbing. **Not released to CWS; not merged to main.** See [`docs/legal/`](docs/legal/).

**On develop since v1.6.0** (post-`bdf3852`, all merged via `(#NNN)` squash commits):

- **[#123] SET-25** Plus Phase 2 — persistent subscription identity (SQLite + key generator + admin CLI).
- **[#124] SET-26** Plus Phase 3 — real Stripe checkout + webhook signature verification + event handlers (checkout.session.completed / subscription.updated / subscription.deleted) + US-only defense-in-depth.
- **[#120] factcheck harden** — claim-detector spoken-number normalization + structured attribution + funding-round + compound-claim bonus; evidence-gated producer tiers (GREEN / THIN / NONE) + QUICK SELF-CHECK (CoVe) block; Director claim-density boost (+0.5 → +2.0, capped). Supersedes the reverted PR [#125].

**Shipped Chrome-Web-Store line (stable):** v1.5.3 "The Cast" (2026-04-20) was the last tag with a wide CWS rollout. v1.5.4/5/6 are dev-infra point releases; v1.6.0 is the flag-gated canary awaiting Railway telemetry + a CWS re-upload.

**Canonical context for work:** [`docs/CONTEXT.md`](docs/CONTEXT.md) — stack, personas, pipeline, cost. If CONTEXT.md disagrees with this INDEX, trust CONTEXT.md.

## What this repo is

Chrome extension + Next.js backend that captures a YouTube tab's audio, transcribes it, and streams back reactions from 4 AI personas. Two persona packs — Howard Stern staff (default) or This Week in Startups lineup.

## Top-level tree

| Directory | Purpose | Index |
|---|---|---|
| [`app/`](app/) | Next.js 15 App Router: legacy landing, `/install`, `/privacy`, API routes. `middleware.ts` 308-redirects non-`/api/*` traffic to `www.peanutgallery.live`. | [`app/INDEX.md`](app/INDEX.md) |
| [`components/`](components/) | React components used by the Next.js landing page (post-v1.5 cleanup — only `FadeInObserver` remains). | [`components/INDEX.md`](components/INDEX.md) |
| [`lib/`](lib/) | Server-side core: Director, PersonaEngine, packs, logging, transcription. | [`lib/INDEX.md`](lib/INDEX.md) |
| [`lib/packs/`](lib/packs/) | Pack abstraction + Howard + TWiST persona definitions. | [`lib/packs/INDEX.md`](lib/packs/INDEX.md) |
| [`extension/`](extension/) | Chrome MV3 extension (side panel, background, offscreen, content). | [`extension/INDEX.md`](extension/INDEX.md) |
| [`scripts/`](scripts/) | Test harnesses + pack-extension release script. | [`scripts/INDEX.md`](scripts/INDEX.md) |
| [`docs/`](docs/) | Humans and Claudes read this. | [`docs/INDEX.md`](docs/INDEX.md) |
| [`marketing/`](marketing/) | Chrome Web Store listing copy, promo assets. | — |
| [`releases/`](releases/) | Gitignored. `peanut-gallery-vX.zip` (CWS upload) + `vX.0.0-release-notes.md`. | — |
| [`logs/`](logs/) | Gitignored. `pipeline-debug.jsonl` + free-tier-limiter state. | — |

## Root-level files

| File | Purpose |
|---|---|
| [`README.md`](README.md) | Public-facing README. Install, personas, cost, deploy. Canonical for humans. |
| [`CHANGELOG.md`](CHANGELOG.md) | Keep-a-Changelog format. v1.0 → v1.4 history. |
| [`SHIP.md`](SHIP.md) | v1.0 launch checklist. Historical but mostly still valid as a ship template. |
| [`SCREENSHOTS.md`](SCREENSHOTS.md) | How to shoot the 5 required CWS screenshots. |
| [`TWIST-AI-SIDEBAR-BUILD-PLAN.md`](TWIST-AI-SIDEBAR-BUILD-PLAN.md) | ARCHIVED — original v1.0 pre-build plan. Banner at top says "do not trust." |
| [`CLAUDE.md`](CLAUDE.md) | **READ FIRST.** AI working agreement for this repo. Non-negotiable rules, esp. the git `index.lock` protocol. Points at [`docs/AI-GIT-PROTOCOL.md`](docs/AI-GIT-PROTOCOL.md) for the full version. |
| [`package.json`](package.json) | Dependencies + scripts. `npm run check` is the pre-merge gate (typecheck + extension syntax + 14 director fixtures × 50 runs). |
| [`next.config.ts`](next.config.ts) | Next.js config. |
| [`tsconfig.json`](tsconfig.json) | TypeScript config. |
| [`Dockerfile`](Dockerfile) | One-shot Railway deploy. |

## Provider stack (v1.4)

- **Transcription:** Deepgram Nova-3.
- **Producer + Joker personas (Baba Booey, Jackie, Molly, Alex):** Anthropic Claude Haiku.
- **Troll + Sound FX personas (Troll, Fred, Jason, Lon):** xAI Grok 4.1 Fast non-reasoning.
- **Fact-check search:** Brave (default) OR xAI Live Search, toggled via side-panel dropdown.

**Required API keys:** Deepgram, Anthropic, xAI. **Optional:** Brave (only if `SEARCH_ENGINE=brave`, which is the default).

## Source-of-truth pointers

| Topic | Go to |
|---|---|
| Stack + architecture + cost | [`docs/CONTEXT.md`](docs/CONTEXT.md) |
| Bug post-mortems + diagnostic checklist | [`docs/DEBUGGING.md`](docs/DEBUGGING.md) |
| Roadmap (v1.5 cycle shipped; v1.7 "Smart Director GA" = next; v1.9 = Bobbleheads stretch; v2.0 = The Gallery launch) | [`docs/ROADMAP.md`](docs/ROADMAP.md) |
| Self-host flow | [`docs/SELF-HOST-INSTALL.md`](docs/SELF-HOST-INSTALL.md) |
| Alternative-backend contract | [`docs/BUILD-YOUR-OWN-BACKEND.md`](docs/BUILD-YOUR-OWN-BACKEND.md) |
| Key rotation / ops | [`docs/OPS.md`](docs/OPS.md) |
| Most recent session handoff | [`docs/SESSION-NOTES-2026-04-21-overnight-push.md`](docs/SESSION-NOTES-2026-04-21-overnight-push.md) |
| Director state (modules, flags, telemetry, PR lineage) | [`docs/STATE-OF-DIRECTOR-2026-04-21.md`](docs/STATE-OF-DIRECTOR-2026-04-21.md) |
| Design principles (durable Seth-directives) | [`docs/DESIGN-PRINCIPLES.md`](docs/DESIGN-PRINCIPLES.md) |
| Persona refinement plan (100+ transcript study) | [`docs/PERSONA-REFINEMENT-PLAN.md`](docs/PERSONA-REFINEMENT-PLAN.md) |
| Persona character research (TWiST pack) | [`docs/packs/twist/RESEARCH.md`](docs/packs/twist/RESEARCH.md) |
| Linear → Claude kickoff pipeline (local daemon) | [`docs/LINEAR-AGENT-RUBRIC.md`](docs/LINEAR-AGENT-RUBRIC.md) + [`scripts/linear-daemon.ts`](scripts/linear-daemon.ts) + [`scripts/install-linear-daemon.sh`](scripts/install-linear-daemon.sh) — setup in [`docs/GITHUB-MANUAL-STEPS.md § 18`](docs/GITHUB-MANUAL-STEPS.md) |
| Release flow + merge-method rule (main-facing PRs are "Rebase and merge" only) | [`docs/RELEASE.md`](docs/RELEASE.md) |
