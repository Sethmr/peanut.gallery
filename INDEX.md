# Peanut Gallery — Repo Index

Machine-readable map of this repo. If you are an AI resuming work here, read this first.

**Current manifest version:** `v2.0.0` ("The Gallery") — CWS launch release. Accumulates everything since v1.5.3: the Plus subscription pipeline (v1.8.0 "Press Pass"), the legal hard-save (v1.7.0 "Fine Print"), the Smart Director v3 canary (v1.6.0 "Canary"), the v1.8 deep-research persona kernels for all 8 personas, plus the v2.0 session push — **fact-check layer methodology** ([`docs/FACT-CHECK-LAYER.md`](docs/FACT-CHECK-LAYER.md)) applied to Baba + Molly via `layered-fact-checker` scaffolding, **inspired-by parody frame** via `persona.inspiredBy` + a prepended PARODY FRAME block at fire time, audio polish (mute-SFX toggle, Jackie↔Jason cue swap, bowling-pin Jason cue, Fred + Lon trims, volume 0.67), Feedback & bugs drawer section, and director-v3 Cerebras shadow log-noise reduction.

**v1.8.0 "The Press Pass"** — absorbed into the v2.0 manifest bump. Plus subscription pipeline end-to-end (SQLite identity, Stripe checkout + webhook, Resend transactional email, dedupe gate, one-click recover-key on 409). Live on Railway from `develop` since 2026-04-22.

**v1.7.0 "The Fine Print"** — hard-save branch + tag on origin (`release/v1.7.0`, tag `v1.7.0`). Rewritten ToS / Privacy drafts, US-only gate on Plus, cookie-consent banner, email-alias plumbing. Absorbed into v2.0 manifest bump. See [`docs/legal/`](docs/legal/).

**v1.6.0 "The Canary"** — Smart Director v3 flag-gated canary on `release/v1.6.0` (PR [#91](https://github.com/Sethmr/peanut.gallery/pull/91)). Absorbed into v2.0 manifest bump. Cerebras shadow telemetry still accumulates on Railway; noise-reduction patches landed in v2.0.

**Prior shipped Chrome-Web-Store line:** v1.5.3 "The Cast" (2026-04-20) was the last wide CWS rollout before v2.0. v2.0 is the first CWS release to carry the v1.6 / v1.7 / v1.8 accumulated work.

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
| Most recent session handoff | [`docs/SESSION-NOTES-2026-04-24-v2-launch-legal-onboarding.md`](docs/SESSION-NOTES-2026-04-24-v2-launch-legal-onboarding.md) |
| Director state (modules, flags, telemetry, PR lineage) | [`docs/STATE-OF-DIRECTOR-2026-04-21.md`](docs/STATE-OF-DIRECTOR-2026-04-21.md) |
| Design principles (durable Seth-directives) | [`docs/DESIGN-PRINCIPLES.md`](docs/DESIGN-PRINCIPLES.md) |
| Fact-check layer (reusable methodology — applied to Baba, ready for future producers) | [`docs/FACT-CHECK-LAYER.md`](docs/FACT-CHECK-LAYER.md) |
| Persona refinement plan (100+ transcript study) | [`docs/PERSONA-REFINEMENT-PLAN.md`](docs/PERSONA-REFINEMENT-PLAN.md) |
| Persona character research (TWiST pack) | [`docs/packs/twist/RESEARCH.md`](docs/packs/twist/RESEARCH.md) |
| Linear → Claude kickoff pipeline (local daemon) | [`docs/LINEAR-AGENT-RUBRIC.md`](docs/LINEAR-AGENT-RUBRIC.md) + [`scripts/linear-daemon.ts`](scripts/linear-daemon.ts) + [`scripts/install-linear-daemon.sh`](scripts/install-linear-daemon.sh) — setup in [`docs/GITHUB-MANUAL-STEPS.md § 18`](docs/GITHUB-MANUAL-STEPS.md) |
| Release flow + merge-method rule (main-facing PRs are "Rebase and merge" only) | [`docs/RELEASE.md`](docs/RELEASE.md) |
