# Getting Help

You're here because something isn't working, something is confusing, or you want to discuss something. Peanut Gallery is a small-team project built in the open — we want you to find the right channel on the first try.

## I found a bug

File a [bug report](ISSUE_TEMPLATE/bug_report.yml). The template forces the right shape:

- Extension version (from `chrome://extensions` or the side-panel footer)
- Backend (hosted / self-hosted / build-your-own)
- Pack (Howard / TWiST / custom)
- Repro steps, expected vs. actual, and — most important — a **paste of the browser console**.

The console paste is load-bearing. Without it, the triage loop is three messages longer.

## I want a feature

Open a [feature request](ISSUE_TEMPLATE/feature_request.yml). Lead with the problem, not the solution. The best feature requests include a use case ("I record a podcast weekly and I wish…") and name the surface where the feature would live (side panel / content script / backend / pack).

Feature priorities are tracked against the [roadmap](../docs/ROADMAP.md). Requests that map cleanly onto an existing release theme move fastest.

## I want to add a persona pack

Every pack is four archetype slots (producer / troll / soundfx / joker) mapped onto the voices you know. Start with the [pack request template](ISSUE_TEMPLATE/pack_request.yml) — filling it out is the design exercise.

If you want to build the pack yourself, skip straight to [`CONTRIBUTING.md`](CONTRIBUTING.md#persona-packs) for the PR checklist.

## I found a security issue

**Do not open a public issue.** Email `security@peanutgallery.live`. Full disclosure policy + supported versions: [`SECURITY.md`](SECURITY.md).

## I just want to chat / brainstorm

GitHub Discussions is the home for open-ended questions, pack ideas before they're fully formed, and "has anyone tried X?" threads.

- [Discussions](https://github.com/Sethmr/peanut.gallery/discussions) — ideas, help, show & tell

## I'm trying to self-host or build my own backend

- [`docs/SELF-HOST-INSTALL.md`](../docs/SELF-HOST-INSTALL.md) — deploying the reference Next.js backend.
- [`docs/BUILD-YOUR-OWN-BACKEND.md`](../docs/BUILD-YOUR-OWN-BACKEND.md) — the wire-protocol contract for alternative backends in any language.
- [`docs/DEBUGGING.md`](../docs/DEBUGGING.md) — post-mortem log + provider-specific error signatures.

If none of those unstick you, open a bug report with `[self-host]` in the title.

## Response time expectations

Peanut Gallery is not a SaaS product. Response times in order of priority:

| Channel | Rough target |
|---|---|
| `security@peanutgallery.live` | ≤ 48 hours |
| Bug reports with a console paste | ≤ 1 week |
| Feature requests | Triaged at the next release cut |
| Discussions | Community-driven; maintainers drop in weekly |
| Pack requests | Queued for Pack Lab (v1.7.0) unless flagship-tier |

If something is on fire and none of the above seems right, email `seth@peanutgallery.live` and start the subject line with `[urgent]`.

## Not supported

- DMs on social media. Public issues scale; DMs don't.
- Anonymous credential-reset requests (Peanut Gallery doesn't store credentials — your API keys live in your browser).
- Questions that are fully answered by `docs/CONTEXT.md`. Please skim it first; we will link you there otherwise.
