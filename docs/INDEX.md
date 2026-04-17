# Peanut Gallery — Docs Index

Map of every markdown file in the repo, ordered by when you should read it.

## Read first (if you're resuming work)

1. [`docs/CONTEXT.md`](CONTEXT.md) — canonical project context. Stack, personas, file map, SSE protocol, cost table, what's done vs. what's left.
2. [`docs/SESSION-NOTES-2026-04-16.md`](SESSION-NOTES-2026-04-16.md) — most recent handoff. §3 is the **immutable** permissions/gesture setup for the Chrome extension — read it before editing `extension/`. §5 is the finish-strong checklist for the bounty.
3. [`docs/DEBUGGING.md`](DEBUGGING.md) — canonical post-mortem log (ISSUE-001..008). Diagnostic checklist + silent-failure table. Read before chasing any pipeline bug.

## Component-specific

- [`extension/README.md`](../extension/README.md) — Chrome extension: install, architecture diagram, why it exists.
- [`README.md`](../README.md) — public-facing README. Setup, personas overview, cost, deploy.
- [`docs/index.html`](index.html) — landing page served at peanutgallery.live (GitHub Pages / Railway).
- [`docs/PODCASTER-SETUP.md`](PODCASTER-SETUP.md) — audio routing guide for OBS, Riverside, SquadCast, BlackHole/Loopback, VB-Audio, RODECaster, GoXLR, Wave XLR. Pairs with the Audio Routing section of the side panel.

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
| Cost per episode | [`CONTEXT.md` — Cost Per Episode](CONTEXT.md#cost-per-episode) |
| SSE event protocol | [`CONTEXT.md` — SSE Event Protocol](CONTEXT.md#sse-event-protocol) |
| Known bugs / post-mortems | [`DEBUGGING.md`](DEBUGGING.md) |
| Finish-strong checklist for the bounty | [`SESSION-NOTES-2026-04-16.md §5`](SESSION-NOTES-2026-04-16.md) |

If you find yourself duplicating any of these into a new file, stop and link instead.
