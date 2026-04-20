# Peanut Gallery — Docs Index

Map of every markdown file in the repo, ordered by when you should read it.

## Read first (if you're resuming work)

0. [`../CLAUDE.md`](../CLAUDE.md) + [`docs/AI-GIT-PROTOCOL.md`](AI-GIT-PROTOCOL.md) — **MANDATORY before any git write.** Peanut Gallery's sandbox cannot recover from an orphaned `.git/index.lock`. Prevention-first + one-shot terminal escalation; NO third-method retries.
0.5. [`docs/RELEASE.md`](RELEASE.md) — **read before any merge.** Branch model (`feature/* → develop → main → tag + CWS`), the asymmetry (Claude self-merges `develop`; only Seth merges `main`), and the self-merge documentation contract. Links rather than duplicates the rest.
0.6. [`docs/BOT-TRIAGE-RUBRIC.md`](BOT-TRIAGE-RUBRIC.md) — **read if you're bot-Claude triaging a Dependabot PR** (fired by [`.github/workflows/claude-triage.yml`](../.github/workflows/claude-triage.yml)). Decision tree (MERGE-NOW / QUEUE-AND-CLOSE / NEEDS-HUMAN), safe-list, comment format, hard scope (no commits, no close, no merge — first iteration is comment-only).
0.7. [`docs/AI-INSTRUCTIONS-POLICY.md`](AI-INSTRUCTIONS-POLICY.md) — **read before editing any file that tells an AI how to behave.** Canonical list of protected paths (CLAUDE.md, .claude/, .github/workflows/, CODEOWNERS, dependabot.yml, the four AI-facing docs under docs/). External PRs touching these auto-close via [`.github/workflows/protect-ai-instructions.yml`](../.github/workflows/protect-ai-instructions.yml); CODEOWNERS is the second gate. Seth is the only human who edits these; Claude edits only when Seth explicitly asks. Change-request path: open an issue, don't submit a PR.
1. [`docs/CONTEXT.md`](CONTEXT.md) — canonical project context. Stack, archetype slots + pack system, file map, SSE protocol, v1.4 pipeline-event list, cost table, what's shipped vs. coming.
2. [`docs/SESSION-NOTES-2026-04-18.md`](SESSION-NOTES-2026-04-18.md) — most recent handoff. Post-v1.3.0 force-react / persona-tap debugging. **Read §1 "meta-note" before touching code** — two files on the working tree are modified but unverified-in-production; §5 is the localhost verification checklist to run first. §4 captures Seth's load-bearing principles (model decides *how* not *if*).
3. [`docs/SESSION-NOTES-2026-04-17.md`](SESSION-NOTES-2026-04-17.md) — prior handoff. v1.1.1 shipped. §3 is the **immutable** server-side demo-keys architecture — do not re-embed keys in the extension. §5 is the finish-strong checklist. §6 points at `ROADMAP.md`.
4. [`docs/SESSION-NOTES-2026-04-16.md`](SESSION-NOTES-2026-04-16.md) — earlier handoff. §3 is the **immutable** permissions/gesture setup for the Chrome extension — read it before editing `extension/`.
5. [`docs/DEBUGGING.md`](DEBUGGING.md) — canonical post-mortem log (ISSUE-001..009), v1.4 pipeline-event names, provider-specific error signatures. Diagnostic checklist + silent-failure table. Read before chasing any pipeline bug.
6. [`docs/STATE-OF-PRODUCT-2026-04-18.md`](STATE-OF-PRODUCT-2026-04-18.md) — snapshot audit as of v1.5.0 feature-complete + pushed. TL;DR of current version, recent commits, canary gate, 9-subsystem health check, known risks, value framing per release. Start here if you're resuming work on/after 2026-04-18.
7. [`docs/ROADMAP.md`](ROADMAP.md) — version-staged plan with fleshed-out sub-steps for near-term releases. Shipped: v1.2 / v1.3 / v1.4 / v1.5 (feature-complete, canary + tag pending). Path to v2.0 (Seth's explicit sequence, 2026-04-19): v1.5.1 Broadsheet Final → v1.6 Settings Pane → v1.7 Smart Director GA → v1.8 Peanut Mascots → v1.9 Bobbleheads (Stretch) → v2.0 "The Gallery" launch with session recall + shareable snippet as the distribution loop. Post-launch: v2.x continuous director + persona model improvements. v3.0: deliberately user-driven — direction defined by what 2.0 users ask for. Deferred off the critical path: Voice / TTS, MP4 clip share, Pack Lab UI, Live Moments, overlay mode, personal-context memory. Don't pull work forward across release boundaries without confirming scope.

## Architecture & operations

- [`docs/SERVER-SIDE-DEMO-KEYS.md`](SERVER-SIDE-DEMO-KEYS.md) — how the backend covers demo users via env-var fallback, and why the extension ships with zero keys. Read before any change to the extension's key-handling code.
- [`docs/OPS.md`](OPS.md) — key rotation runbook, provider dashboards, cap locations, post-TWiST checklist.
- [`docs/AI-GIT-PROTOCOL.md`](AI-GIT-PROTOCOL.md) — **read before any git write.** Prevention rules + one-shot escalation when `.git/index.lock` appears. Source of truth for the hard "no third method" rule. Supersedes all earlier ad-hoc guidance.
- [`docs/BUILD-YOUR-OWN-BACKEND.md`](BUILD-YOUR-OWN-BACKEND.md) — contract for anyone running an alternative backend.
- [`docs/SELF-HOST-INSTALL.md`](SELF-HOST-INSTALL.md) — install flow for users deploying their own Next.js app.

## Component-specific

- [`extension/README.md`](../extension/README.md) — Chrome extension: install, architecture diagram, why it exists.
- [`README.md`](../README.md) — public-facing README. Setup, personas overview, cost, deploy.
- [`AUTHORS.md`](../AUTHORS.md) — credits ledger: Seth, Jason + Lon, Claude Design, OSS deps.
- [`docs/index.html`](index.html) — legacy reference landing page kept in-repo for the self-host preview only. Production marketing now lives at [www.peanutgallery.live](https://www.peanutgallery.live) and is served from the [`Sethmr/peanut.gallery.site`](https://github.com/Sethmr/peanut.gallery.site) repo (GitHub Pages).
- [`docs/PODCASTER-SETUP.md`](PODCASTER-SETUP.md) — audio routing guide for OBS, Riverside, SquadCast, BlackHole/Loopback, VB-Audio, RODECaster, GoXLR, Wave XLR. Pairs with the Audio Routing section of the side panel.
- [`docs/packs/twist/RESEARCH.md`](packs/twist/RESEARCH.md) — character research for the TWiST pack (Molly Wood, Jason Calacanis, Lon Harris, Alex Wilhelm). Source of truth when a TWiST voice feels off; paired with `lib/packs/twist/personas.ts`.

## In progress

- [`docs/V1.5-PLAN.md`](V1.5-PLAN.md) — step-by-step implementation plan for v1.5.0 "Smart Director v2." Scaffold landed `4b5cd2c` (2026-04-18); canary + tag outstanding. See §4 for the roll-up metrics that gate the release.

## Strategy & research

- [`docs/COMPETITIVE-LANDSCAPE-2026-04-18.md`](COMPETITIVE-LANDSCAPE-2026-04-18.md) — competitive landscape snapshot (April 2026). Direct competitors (Dmooji, Questie AI, ai_licia), adjacent NotebookLM-style generators, research frontier (LiveCC CVPR 2025 streaming video LLM), and positioning takeaways for Pg. **Refresh at v1.6 ship or every ~90 days.** Read before any roadmap / marketing / monetization decision — the "Director is the moat" framing + "podcast-first beats YouTube-generic" framing drive downstream choices.

## Archived (do not trust as source of truth)

- [`docs/V1.2-PLAN.md`](V1.2-PLAN.md) — step-by-step implementation plan for v1.2.0. Shipped; kept for history.
- [`docs/V1.3-PLAN.md`](V1.3-PLAN.md) — step-by-step implementation plan for v1.3.0 (TWiST pack). Shipped; kept for history.
- [`docs/TEST-V1.1.md`](TEST-V1.1.md) — end-to-end test checklist used before the v1.1 Railway deploy + CWS publish. Shipped; kept for history.
- [`TWIST-AI-SIDEBAR-BUILD-PLAN.md`](../TWIST-AI-SIDEBAR-BUILD-PLAN.md) — original pre-build plan from 2026-04-15. References "Chaos Agent" (now Fred Norris), Vercel (now Railway), `twist-sidebar` (now `peanut.gallery`), and `-f wav` (fixed to `-f s16le`). Kept for history; superseded by CONTEXT.md.

## Community & governance

Pages that appear on the GitHub repo front and matter to anyone landing from the wild:

- [`../.github/CONTRIBUTING.md`](../.github/CONTRIBUTING.md) — how to ship a useful PR; pre-PR checks; commit style; the non-negotiables.
- [`../.github/CODE_OF_CONDUCT.md`](../.github/CODE_OF_CONDUCT.md) — builder-community norms, short form.
- [`../.github/SECURITY.md`](../.github/SECURITY.md) — disclosure policy + `security@peanutgallery.live` + supported versions table.
- [`../.github/SUPPORT.md`](../.github/SUPPORT.md) — triage guide: bug / feature / pack / security / discussion.
- [`../AUTHORS.md`](../AUTHORS.md) — credits ledger.
- [`../LICENSE`](../LICENSE) — MIT.
- [`../.github/ISSUE_TEMPLATE/`](../.github/ISSUE_TEMPLATE/) — bug report, feature request, pack request templates.
- [`../.github/PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md) — the what/why/how/testing/risk shape every PR needs.
- [`docs/GITHUB-MANUAL-STEPS.md`](GITHUB-MANUAL-STEPS.md) — one-time GitHub web-UI actions Seth needs to take to complete the page-architecture audit (About card, topics, Discussions, labels, branch protection, Sponsors, security features).

## Source of truth — one thing per topic

To avoid the duplication that prompted this audit, each topic has ONE canonical home:

| Topic | Canonical source |
|---|---|
| AI git / `.git/index.lock` protocol | [`AI-GIT-PROTOCOL.md`](AI-GIT-PROTOCOL.md) + [`../CLAUDE.md`](../CLAUDE.md) |
| Branch model + release flow + Claude's self-merge contract | [`RELEASE.md`](RELEASE.md) + [`../.claude/settings.json`](../.claude/settings.json) |
| Dependabot PR triage rubric (bot-Claude playbook) | [`BOT-TRIAGE-RUBRIC.md`](BOT-TRIAGE-RUBRIC.md) + [`../.github/workflows/claude-triage.yml`](../.github/workflows/claude-triage.yml) |
| AI-instruction file protection (who can edit what) | [`AI-INSTRUCTIONS-POLICY.md`](AI-INSTRUCTIONS-POLICY.md) + [`../.github/workflows/protect-ai-instructions.yml`](../.github/workflows/protect-ai-instructions.yml) + [`../.github/CODEOWNERS`](../.github/CODEOWNERS) |
| "What Jason wants" spec | [`CONTEXT.md` — What Jason Wants](CONTEXT.md#what-jason-wants-master-truth) |
| Persona list + character research | `lib/packs/<pack>/personas.ts` (code) + [`CONTEXT.md` — The 4 Archetype Slots](CONTEXT.md#the-4-archetype-slots-swappable-via-persona-packs) (table). TWiST-specific voice notes: [`docs/packs/twist/RESEARCH.md`](packs/twist/RESEARCH.md). |
| Architecture diagram | [`CONTEXT.md` — Architecture](CONTEXT.md#architecture) |
| Chrome extension architecture | [`extension/README.md`](../extension/README.md) + [`CONTEXT.md` — Chrome Extension](CONTEXT.md#chrome-extension) |
| Chrome extension permissions + gesture flow | [`SESSION-NOTES-2026-04-16.md §3`](SESSION-NOTES-2026-04-16.md) (immutable) |
| Server-side demo keys + key fallback | [`SERVER-SIDE-DEMO-KEYS.md`](SERVER-SIDE-DEMO-KEYS.md) (immutable — do not re-embed keys) |
| Key rotation + provider dashboards | [`OPS.md`](OPS.md) |
| Cost per episode | [`CONTEXT.md` — Cost Per Episode](CONTEXT.md#cost-per-episode) |
| SSE event protocol | [`CONTEXT.md` — SSE Event Protocol](CONTEXT.md#sse-event-protocol) |
| Known bugs / post-mortems | [`DEBUGGING.md`](DEBUGGING.md) |
| Roadmap / pending work | [`ROADMAP.md`](ROADMAP.md) |
| Competitive landscape / positioning | [`COMPETITIVE-LANDSCAPE-2026-04-18.md`](COMPETITIVE-LANDSCAPE-2026-04-18.md) (refresh every ~90 days) |
| Finish-strong checklist for the bounty | [`SESSION-NOTES-2026-04-17.md §5`](SESSION-NOTES-2026-04-17.md) |

If you find yourself duplicating any of these into a new file, stop and link instead.
