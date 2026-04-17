# Peanut Gallery — Docs Index

Map of every markdown file in the repo, ordered by when you should read it.

## Read first (if you're resuming work)

1. [`docs/CONTEXT.md`](CONTEXT.md) — canonical project context. Stack, personas, file map, SSE protocol, cost table, what's done vs. what's left.
2. [`docs/SESSION-NOTES-2026-04-17.md`](SESSION-NOTES-2026-04-17.md) — most recent handoff. v1.1.1 shipped. §3 is the **immutable** server-side demo-keys architecture — do not re-embed keys in the extension. §5 is the finish-strong checklist. §6 points at `ROADMAP.md`.
3. [`docs/SESSION-NOTES-2026-04-16.md`](SESSION-NOTES-2026-04-16.md) — prior handoff. §3 is the **immutable** permissions/gesture setup for the Chrome extension — read it before editing `extension/`.
4. [`docs/DEBUGGING.md`](DEBUGGING.md) — canonical post-mortem log (ISSUE-001..009). Diagnostic checklist + silent-failure table. Read before chasing any pipeline bug.
5. [`docs/ROADMAP.md`](ROADMAP.md) — pending work beyond v1.1.1 (greenlight-pending). Don't start items from here without confirming scope.

## Architecture & operations

- [`docs/SERVER-SIDE-DEMO-KEYS.md`](SERVER-SIDE-DEMO-KEYS.md) — how the backend covers demo users via env-var fallback, and why the extension ships with zero keys. Read before any change to the extension's key-handling code.
- [`docs/OPS.md`](OPS.md) — key rotation runbook, provider dashboards, cap locations, post-TWiST checklist.
- [`docs/BUILD-YOUR-OWN-BACKEND.md`](BUILD-YOUR-OWN-BACKEND.md) — contract for anyone running an alternative backend.
- [`docs/SELF-HOST-INSTALL.md`](SELF-HOST-INSTALL.md) — install flow for users deploying their own Next.js app.

## Component-specific

- [`extension/README.md`](../extension/README.md) — Chrome extension: install, architecture diagram, why it exists.
- [`README.md`](../README.md) — public-facing README. Setup, personas overview, cost, deploy.
- [`docs/index.html`](index.html) — landing page served at peanutgallery.live (GitHub Pages / Railway).
- [`docs/PODCASTER-SETUP.md`](PODCASTER-SETUP.md) — audio routing guide for OBS, Riverside, SquadCast, BlackHole/Loopback, VB-Audio, RODECaster, GoXLR, Wave XLR. Pairs with the Audio Routing section of the side panel.
- [`docs/TEST-V1.1.md`](TEST-V1.1.md) — end-to-end test checklist for the v1.1 release (persona rebalance, passthrough toggle, start/stop reliability). Run before Railway deploy + CWS publish.

## Archived (do not trust as source of truth)

- [`TWIST-AI-SIDEBAR-BUILD-PLAN.md`](../TWIST-AI-SIDEBAR-BUILD-PLAN.md) — original pre-build plan from 2026-04-15. References "Chaos Agent" (now Fred Norris), Vercel (now Railway), `twist-sidebar` (now `peanut.gallery`), and `-f wav` (fixed to `-f s16le`). Kept for history; superseded by CONTEXT.md.

## Source of truth — one thing per topic

To avoid the duplication that prompted this audit, each topic has ONE canonical home:

| Topic | Canonical source |
|---|---|
| "What Jason wants" spec | [`CONTEXT.md` — What Jason Wants](CONTEXT.md#what-jason-wants-master-truth) |
| Persona list + character research | `lib/personas.ts` (code) + [`CONTEXT.md` — The 4 Personas](CONTEXT.md#the-4-personas-howard-stern-show-staff) (table) |
| Architecture diagram | [`CONTEXT.md` — Architecture](CONTEXT.md#architecture) |
| Chrome extension architecture | [`extension/README.md`](../extension/README.md) + [`CONTEXT.md` — Chrome Extension](CONTEXT.md#chrome-extension) |
| Chrome extension permissions + gesture flow | [`SESSION-NOTES-2026-04-16.md §3`](SESSION-NOTES-2026-04-16.md) (immutable) |
| Server-side demo keys + key fallback | [`SERVER-SIDE-DEMO-KEYS.md`](SERVER-SIDE-DEMO-KEYS.md) (immutable — do not re-embed keys) |
| Key rotation + provider dashboards | [`OPS.md`](OPS.md) |
| Cost per episode | [`CONTEXT.md` — Cost Per Episode](CONTEXT.md#cost-per-episode) |
| SSE event protocol | [`CONTEXT.md` — SSE Event Protocol](CONTEXT.md#sse-event-protocol) |
| Known bugs / post-mortems | [`DEBUGGING.md`](DEBUGGING.md) |
| Roadmap / pending work | [`ROADMAP.md`](ROADMAP.md) |
| Finish-strong checklist for the bounty | [`SESSION-NOTES-2026-04-17.md §5`](SESSION-NOTES-2026-04-17.md) |

If you find yourself duplicating any of these into a new file, stop and link instead.
