# Peanut Gallery — Repo Index

Machine-readable map of this repo. If you are an AI resuming work here, read this first.

**Current version:** v1.5.1 "The Broadsheet" — shipped 2026-04-19. v1.4.0 "Grok & Stability" is the last tagged version live on the Chrome Web Store; v1.5 landed the newspaper/broadsheet redesign + Smart Director v2 scaffolding + free-tier status strip, and v1.5.1 is the follow-up polish round (transcript ticker smoothing, muted-mug + filter-pill strike visuals, install-page both-packs copy, design-doc cleanup).

**Canonical context for work:** [`docs/CONTEXT.md`](docs/CONTEXT.md) — stack, personas, pipeline, cost. If CONTEXT.md disagrees with this INDEX, trust CONTEXT.md.

## What this repo is

Chrome extension + Next.js backend that captures a YouTube tab's audio, transcribes it, and streams back reactions from 4 AI personas. Two persona packs — Howard Stern staff (default) or This Week in Startups lineup.

## Top-level tree

| Directory | Purpose | Index |
|---|---|---|
| [`app/`](app/) | Next.js 15 App Router: landing page, `/install`, `/watch`, `/privacy`, API routes. | [`app/INDEX.md`](app/INDEX.md) |
| [`components/`](components/) | React components used by the Next.js landing + `/watch`. | [`components/INDEX.md`](components/INDEX.md) |
| [`lib/`](lib/) | Server-side core: Director, PersonaEngine, packs, logging, transcription. | [`lib/INDEX.md`](lib/INDEX.md) |
| [`lib/packs/`](lib/packs/) | Pack abstraction + Howard + TWiST persona definitions. | [`lib/packs/INDEX.md`](lib/packs/INDEX.md) |
| [`extension/`](extension/) | Chrome MV3 extension (side panel, background, offscreen, content). | [`extension/INDEX.md`](extension/INDEX.md) |
| [`scripts/`](scripts/) | Test harnesses + pack-extension release script. | [`scripts/INDEX.md`](scripts/INDEX.md) |
| [`docs/`](docs/) | Humans and Claudes read this. | [`docs/INDEX.md`](docs/INDEX.md) |
| [`types/`](types/) | Ambient TypeScript declarations (currently just YouTube IFrame API). | — |
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
| Roadmap (v1.5 = Smart Director v2, v1.6 = Voice+Clip, v2.0 = Bobbleheads) | [`docs/ROADMAP.md`](docs/ROADMAP.md) |
| Self-host flow | [`docs/SELF-HOST-INSTALL.md`](docs/SELF-HOST-INSTALL.md) |
| Alternative-backend contract | [`docs/BUILD-YOUR-OWN-BACKEND.md`](docs/BUILD-YOUR-OWN-BACKEND.md) |
| Key rotation / ops | [`docs/OPS.md`](docs/OPS.md) |
| Most recent session handoff | [`docs/SESSION-NOTES-2026-04-18.md`](docs/SESSION-NOTES-2026-04-18.md) |
| Persona character research (TWiST pack) | [`docs/packs/twist/RESEARCH.md`](docs/packs/twist/RESEARCH.md) |
