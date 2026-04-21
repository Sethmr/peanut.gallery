# Peanut Gallery — Docs Index

Map of every markdown file in the repo, ordered by when you should read it.

## Read first (if you're resuming work)

0. [`../CLAUDE.md`](../CLAUDE.md) + [`docs/AI-GIT-PROTOCOL.md`](AI-GIT-PROTOCOL.md) — **MANDATORY before any git write.** Peanut Gallery's sandbox cannot recover from an orphaned `.git/index.lock`. Prevention-first + one-shot terminal escalation; NO third-method retries.
0.5. [`docs/RELEASE.md`](RELEASE.md) — **read before any merge.** Branch model (`feature/* → develop → release/vX.Y.Z → main`; hotfixes also route through `develop`), the asymmetry (Claude self-merges `develop`; only Seth merges `main` via `release/*` PRs), and the self-merge documentation contract. Links rather than duplicates the rest.
0.6. [`docs/BOT-TRIAGE-RUBRIC.md`](BOT-TRIAGE-RUBRIC.md) — **read if you're bot-Claude triaging a Dependabot PR** (fired by [`.github/workflows/claude-triage.yml`](../.github/workflows/claude-triage.yml)). Decision tree (MERGE-NOW / QUEUE-AND-CLOSE / NEEDS-HUMAN), safe-list, comment format, hard scope (no commits, no close, no merge — first iteration is comment-only).
0.7. [`docs/AI-INSTRUCTIONS-POLICY.md`](AI-INSTRUCTIONS-POLICY.md) — **read before editing any file that tells an AI how to behave.** Canonical list of protected paths (CLAUDE.md, .claude/, .github/workflows/, CODEOWNERS, dependabot.yml, the four AI-facing docs under docs/). External PRs touching these auto-close via [`.github/workflows/protect-ai-instructions.yml`](../.github/workflows/protect-ai-instructions.yml); CODEOWNERS is the second gate. Seth is the only human who edits these; Claude edits only when Seth explicitly asks. Change-request path: open an issue, don't submit a PR.
0.8. [`docs/DESIGN-PRINCIPLES.md`](DESIGN-PRINCIPLES.md) — **read before proposing architecture changes or "cleanups."** Durable Seth-directives: never empty animations, balance characters, fact-check sensitivity is per-pack, customer value > industry norms, privacy posture, SILENT is first-class, model-decides-HOW-not-IF. Every rule carries its date + rationale; if a change would violate one, pitch it first. Companion: [`docs/PERSONA-REFINEMENT-PLAN.md`](PERSONA-REFINEMENT-PLAN.md) — the ≥100-transcript grounding plan for the 8 shipping personas (pending, kicks off after SET-14 canary).
0.9. [`docs/PEANUT-AVATAR-RESEARCH-2026-04-21.md`](PEANUT-AVATAR-RESEARCH-2026-04-21.md) — deep research on making the peanut mascots feel genuinely 3D. Surveys 9 techniques (SVG filters, CSS 3D layer parallax, Rive, Lottie, Three.js, sprite sheets, AI MP4 loops, SVG design polish, cel-shading); recommends a 2-stage path (SVG filter-lighting afternoon → pre-rendered animated-WebP sprite sheets). Filed: SET-21 (stage 1, Todo) + SET-22 (stage 2, Backlog).
0.95. [`docs/CEREBRAS-INTEGRATION.md`](CEREBRAS-INTEGRATION.md) — step-by-step operational guide to enable the Cerebras Llama 3.1 8B shadow router alongside the v3 Haiku primary. Covers signup, local dev, Railway deployment, verification, analyzer reads, rollback, cost expectations, troubleshooting. Read when you're ready to run the SET-14 canary with shadow data.
1. [`docs/CONTEXT.md`](CONTEXT.md) — canonical project context. Stack, archetype slots + pack system, file map, SSE protocol, v1.4 pipeline-event list, cost table, what's shipped vs. coming.
2. [`docs/SESSION-NOTES-2026-04-21-overnight-push.md`](SESSION-NOTES-2026-04-21-overnight-push.md) — **most recent handoff.** 5 more PRs (#74–#78) on top of the catch-up run: v3 cache padding, logging gaps, empty-state companions + v3 debug panel, debug polish, session-recall groundwork. Includes the testing quickstart + flag matrix + known caveats. Start here if you woke up to PRs.
2.05. [`docs/SESSION-NOTES-2026-04-21-opus-catchup.md`](SESSION-NOTES-2026-04-21-opus-catchup.md) — earlier handoff from same day: Opus catch-up that merged #67/#68 and reviewed #61. Pair with the overnight-push notes above for the full 12-PR picture (#67 through #78).
2.1. [`docs/STATE-OF-DIRECTOR-2026-04-21.md`](STATE-OF-DIRECTOR-2026-04-21.md) — **canonical Director state.** Modules, flags, env vars, telemetry events, test coverage, PR lineage, dependency graph between tickets, cost table under each provider, rollback levers, standing invariants. Start here before touching `lib/director*.ts`.
2.2. [`docs/SESSION-NOTES-2026-04-20-autonomous-pass.md`](SESSION-NOTES-2026-04-20-autonomous-pass.md) — 2026-04-20 autonomous pass; six merged PRs (SEO refresh, `/watch` retirement, logging, a11y, orphan dep, session notes).
2.3. [`docs/SESSION-NOTES-2026-04-20-director-v3-deep-build.md`](SESSION-NOTES-2026-04-20-director-v3-deep-build.md) — the initial v3 Director deep-build pass; lands `director-v3-silent-slot-2026-04-20` branch (SILENT slot + tool_use + confidence + callback memory). That branch was superseded by PR #68 on 2026-04-21; keep for design rationale + open-questions context.
2.4. [`docs/SESSION-NOTES-2026-04-18.md`](SESSION-NOTES-2026-04-18.md) — post-v1.3.0 force-react / persona-tap debugging. **Read §1 "meta-note" before touching code** — two files on the working tree are modified but unverified-in-production; §5 is the localhost verification checklist to run first. §4 captures Seth's load-bearing principles (model decides *how* not *if*).
2.5. [`docs/SESSION-NOTES-2026-04-18-seo-push.md`](SESSION-NOTES-2026-04-18-seo-push.md) — paired with the handoff above, covers the same day's SEO / marketing / UI-redesign work. Claude Design brief, CWS baseline audits, Jason-calibrated landing-page palette shift, and the standing manual-queue Seth still needs to work through. Seth's "hard rules" section near the bottom calls out load-bearing constraints (`/watch` is legacy, server-side demo keys immutable, etc.).
3. [`docs/SESSION-NOTES-2026-04-17.md`](SESSION-NOTES-2026-04-17.md) — prior handoff. v1.1.1 shipped. §3 is the **immutable** server-side demo-keys architecture — do not re-embed keys in the extension. §5 is the finish-strong checklist. §6 points at `ROADMAP.md`.
4. [`docs/SESSION-NOTES-2026-04-16.md`](SESSION-NOTES-2026-04-16.md) — earlier handoff. §3 is the **immutable** permissions/gesture setup for the Chrome extension — read it before editing `extension/`.
5. [`docs/DEBUGGING.md`](DEBUGGING.md) — canonical post-mortem log (ISSUE-001..009), v1.4 pipeline-event names, provider-specific error signatures. Diagnostic checklist + silent-failure table. Read before chasing any pipeline bug.
6. [`docs/STATE-OF-PRODUCT-2026-04-18.md`](STATE-OF-PRODUCT-2026-04-18.md) — wider product audit as of v1.5.0 feature-complete + pushed. Pair with `STATE-OF-DIRECTOR-2026-04-21.md` above (wider product state vs. Director-specific state).
7. [`docs/ROADMAP.md`](ROADMAP.md) — version-staged plan. **Shipped** (full list in the doc): v1.2 through v1.5.6, and v1.6.0 "The Canary" is on `develop` (release held back for patches; `release/v1.6.0` branch preserved per rule #4). Canary exercises the Smart Director v3 (Haiku `tool_use` + Cerebras/Groq shadow) behind `ENABLE_SMART_DIRECTOR_V2`; analyzer telemetry gates the v1.7 GA promotion. **Next** (reality-aligned sequence, 2026-04-21): v1.7.x Smart Director GA (retire rule-based scorer as primary) → v1.8.x persona refinement sprint (100+ transcripts per pack) → v1.9.x subscription tier (alt to BYOK, weekly-hours cap) → v1.10.x avatar stage 2 (bobbleheads or 2.5D/Lottie/MP4 fallback) → **v2.0 "The Gallery"** launch with session recall + Broadsheet quote card + auto-highlights as the distribution loop. Post-launch: v2.x continuous Director/persona improvements; v3.0 deliberately user-driven. **Deferred off the critical path**: Voice/TTS, MP4 clip share, Pack Lab UI, overlay/danmaku mode, personal-context memory. Earlier slot labels (v1.6 "Settings Pane", v1.8 "Peanut Mascots") shipped early inside v1.5.x releases and the slot numbers were reclaimed for what actually landed. Don't pull work forward across release boundaries without confirming scope.

## Architecture & operations

- [`docs/SERVER-SIDE-DEMO-KEYS.md`](SERVER-SIDE-DEMO-KEYS.md) — how the backend covers demo users via env-var fallback, and why the extension ships with zero keys. Read before any change to the extension's key-handling code.
- [`docs/OPS.md`](OPS.md) — key rotation runbook, provider dashboards, cap locations, post-TWiST checklist.
- [`docs/AI-GIT-PROTOCOL.md`](AI-GIT-PROTOCOL.md) — **read before any git write.** Prevention rules + one-shot escalation when `.git/index.lock` appears. Source of truth for the hard "no third method" rule. Supersedes all earlier ad-hoc guidance.
- [`docs/LINEAR-AGENT-RUBRIC.md`](LINEAR-AGENT-RUBRIC.md) — Linear → Claude kickoff pipeline (local-daemon-only as of 2026-04-20; the earlier webhook path is retired): Linear Todo transition → [`scripts/linear-daemon.ts`](../scripts/linear-daemon.ts) → worktree → PR → auto-merge (or `needs-review` opt-out). Claude's authority scope, commit style, and pre-merge gate for Linear-triggered work. Setup in [`GITHUB-MANUAL-STEPS.md § 18`](GITHUB-MANUAL-STEPS.md).
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

- **v1.6.0 "The Canary"** (release PR [#91](https://github.com/Sethmr/peanut.gallery/pull/91) closed pending patches; `release/v1.6.0` branch preserved on the remote per rule #4). All feature work landed on `develop`: Smart Director v3 canary (Haiku `tool_use` + Cerebras/Groq shadow), fact-check gate, fallback telemetry + penalty loop, peanut avatar stage 1, empty-state companions, director debug panel polish, 60 s silence auto-stop, feed-entry action menu, Room Volume segmented control. Awaiting patches before re-cutting (force-update `release/v1.6.0` or roll to `release/v1.6.1`).
- [`docs/V1.5-PLAN.md`](V1.5-PLAN.md) — historical implementation plan for v1.5.0 "Smart Director v2." Superseded by the v1.6.0 canary work documented in [`STATE-OF-DIRECTOR-2026-04-21.md`](STATE-OF-DIRECTOR-2026-04-21.md) and [`CEREBRAS-INTEGRATION.md`](CEREBRAS-INTEGRATION.md).
- [`docs/PERSONA-REFINEMENT-PLAN.md`](PERSONA-REFINEMENT-PLAN.md) — Phase 1 data collection strategy; copy-paste execution guide is [`PERSONA-DATA-ACQUISITION-GUIDE.md`](PERSONA-DATA-ACQUISITION-GUIDE.md). Ships as v1.8.x after v1.7 GA.
- **Linear tickets in progress (spawned separately):** [`SET-23`](https://linear.app/seth-dev/issue/SET-23) quote-card PNG renderer · [`SET-24`](https://linear.app/seth-dev/issue/SET-24) smart-highlight picker.

## Strategy & research

- [`docs/COMPETITIVE-LANDSCAPE-2026-04-21.md`](COMPETITIVE-LANDSCAPE-2026-04-21.md) — **latest** competitive / feature-gap pass. Top-5 must-haves for v2.0 (Broadsheet quote card, auto-highlights, Room Volume dial, upvote/downvote, pin favorite) + should-haves (Spotify / Twitch support, chapter ingestion, live-chat spike trigger, persona intros) + opportunity gaps. Read before triaging v2.0 Linear tickets. Priors: [`COMPETITIVE-LANDSCAPE-2026-04-18.md`](COMPETITIVE-LANDSCAPE-2026-04-18.md). Refresh every ~90 days.
- [`docs/AUDIT-2026-04-21.md`](AUDIT-2026-04-21.md) — pre-v2.0 codebase audit. 19 findings triaged (3 already resolved, 3 fixed inline, 13 deferred with suggested tickets). Cross-checked against design principles. Priority order for deferred tickets lives at the bottom.

## Reviews

Written-for-the-file PR reviews. Local only (not posted on GitHub) — intended as before-reading for a PR, advisory for a daemon re-run, or rationale for a held-back merge.

- [`docs/reviews/SET-6-opus-review-2026-04-21.md`](reviews/SET-6-opus-review-2026-04-21.md) — before-reading for PR [#68](https://github.com/Sethmr/peanut.gallery/pull/68). Maps Sonnet's merged SET-6 implementation (#65) to what changed in the Opus follow-up.
- [`docs/reviews/SET-8-opus-review-2026-04-21.md`](reviews/SET-8-opus-review-2026-04-21.md) — advisory review for the still-open PR [#61](https://github.com/Sethmr/peanut.gallery/pull/61). In-band re-roll regresses streaming UX by up to 8 s; recommends across-turn mitigation (filed as [SET-15](https://linear.app/seth-dev/issue/SET-15)).

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
| **Pack authoring + producer contract** | [`PACK-AUTHORING-GUIDE.md`](PACK-AUTHORING-GUIDE.md) — living doc. Archetype slots, `Persona` type fields, producer correction-tier system, `factCheckMode` dial, pack registration, refinement loop. |
| **Persona voice-data collection** | [`PERSONA-REFINEMENT-PLAN.md`](PERSONA-REFINEMENT-PLAN.md) (strategy) + [`PERSONA-DATA-ACQUISITION-GUIDE.md`](PERSONA-DATA-ACQUISITION-GUIDE.md) (copy-paste operator guide, under $20 budget, public sources only). |
| Architecture diagram | [`CONTEXT.md` — Architecture](CONTEXT.md#architecture) |
| Chrome extension architecture | [`extension/README.md`](../extension/README.md) + [`CONTEXT.md` — Chrome Extension](CONTEXT.md#chrome-extension) |
| Chrome extension permissions + gesture flow | [`SESSION-NOTES-2026-04-16.md §3`](SESSION-NOTES-2026-04-16.md) (immutable) |
| Server-side demo keys + key fallback | [`SERVER-SIDE-DEMO-KEYS.md`](SERVER-SIDE-DEMO-KEYS.md) (immutable — do not re-embed keys) |
| Key rotation + provider dashboards | [`OPS.md`](OPS.md) |
| Cost per episode | [`CONTEXT.md` — Cost Per Episode](CONTEXT.md#cost-per-episode) |
| SSE event protocol | [`CONTEXT.md` — SSE Event Protocol](CONTEXT.md#sse-event-protocol) |
| Known bugs / post-mortems | [`DEBUGGING.md`](DEBUGGING.md) |
| Roadmap / pending work | [`ROADMAP.md`](ROADMAP.md) |
| Director state (modules, flags, telemetry, PR lineage) | [`STATE-OF-DIRECTOR-2026-04-21.md`](STATE-OF-DIRECTOR-2026-04-21.md) |
| Design principles (Seth-directives, durable) | [`DESIGN-PRINCIPLES.md`](DESIGN-PRINCIPLES.md) |
| Persona refinement plan (100+ transcript study) | [`PERSONA-REFINEMENT-PLAN.md`](PERSONA-REFINEMENT-PLAN.md) |
| Competitive landscape / positioning | [`COMPETITIVE-LANDSCAPE-2026-04-21.md`](COMPETITIVE-LANDSCAPE-2026-04-21.md) (latest — feature-gap pass; priors: [`2026-04-18`](COMPETITIVE-LANDSCAPE-2026-04-18.md)). Refresh every ~90 days. |
| Finish-strong checklist for the bounty | [`SESSION-NOTES-2026-04-17.md §5`](SESSION-NOTES-2026-04-17.md) |

If you find yourself duplicating any of these into a new file, stop and link instead.
