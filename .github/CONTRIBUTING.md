# Contributing to Peanut Gallery

The short version: **ship specific, useful PRs.** The long version is below.

## Before you start

1. Read [CLAUDE.md](../CLAUDE.md) at the repo root. It's written for AI collaborators but humans should read it too — it's the shortest path to "what matters in this repo" (the git-lock protocol, the manifest-at-zip-root rule, the version-scheme-and-why, etc.).
2. Skim [docs/CONTEXT.md](../docs/CONTEXT.md) for the overall system shape.
3. Match the scope: one logical change per PR. Bundle-refactors land as multiple PRs unless I've explicitly asked for a single commit.

## Dev loop

```bash
git clone https://github.com/Sethmr/peanut.gallery.git
cd peanut.gallery
./setup.sh          # install deps + scaffold .env.local
npm run dev         # local backend on :3000

# Load the extension in Chrome:
#   chrome://extensions → Developer mode → Load unpacked → extension/
```

Full local setup: [docs/SELF-HOST-INSTALL.md](../docs/SELF-HOST-INSTALL.md).

## Checks to run before you open a PR

```bash
npm run check
```

is a wrapper around:

- `npm run typecheck` — `tsc --noEmit`
- `npm run check:extension` — `node --check` every file in `extension/` (catches syntax mistakes that MV3 would otherwise silently swallow)
- `npm run test:director` — the persona-routing / cascade fixtures

Seth runs these locally before every merge. Land with them green; if any fail in your environment but not mine, call it out in the PR description so we can debug together rather than ship red.

If you're adding a persona-routing behavior, drop a fixture in the director test harness. The pattern is documented inline in `scripts/test-director.ts` and the three v1.5 LLM-override fixtures are good templates.

## Commit style

```
type: short description — the witty why
```

Types: `feat`, `fix`, `chore`, `debug`, `test`, `docs`

Examples from the log:

- `feat: Chrome extension for tab audio capture — YouTube can't block what it can't see`
- `fix: stall detector now handles browser audio mode correctly`
- `chore: clean repo for open-source release`

One logical change per commit. Don't let changes pile up across multiple features.

## The non-negotiables

These rules exist because they've been violated before and it hurt. [CLAUDE.md](../CLAUDE.md) has the full list. The short version:

- **Never touch the git-lock recovery loop beyond the documented two attempts.** If prevention fails, escalate to Seth's real terminal.
- **Manifest.json at zip root, not nested in a wrapper folder.** CWS won't accept anything else.
- **Explicit paths in `git add`.** Never `-A` or `.`. Secrets in `.env.local` have bitten us once already.
- **Never skip hooks (`--no-verify`) or bypass signing.** If a hook fails, fix the underlying issue.

## PR expectations

Use the [PR template](PULL_REQUEST_TEMPLATE.md) — every field earns its keep. Screenshots for UI changes. Risk tier on every PR. Closes-# linked for every issue the PR clears.

## Persona packs

A new pack is four archetype slots (producer / troll / soundfx / joker) mapped onto your four voices. Start with the [pack request issue template](ISSUE_TEMPLATE/pack_request.yml) — it forces the right shape.

Pack PRs need:

- A `docs/packs/<pack>/RESEARCH.md` with the public reference material the characterization came from.
- Anti-impersonation guardrails in every prompt.
- A director fixture showing the pack routes correctly for its intended content domain.
- A sample fire per persona in the PR description.

## Reporting security issues

Do not open a public issue. See [SECURITY.md](SECURITY.md).

## Code of conduct

Short version: be useful, be specific, don't be mean to real people. Full version: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## What Seth merges fast

- Director fixture coverage for regressions that bit you.
- Bug fixes with a failing test in the PR.
- New packs with research notes, director fixtures, and sample fires.
- Docs PRs that reduce context needed to understand a subsystem.
- Accessibility fixes — keyboard nav, screen reader, focus order, contrast.

## What Seth sits on

- Refactors with no user-visible win.
- New features without a loud "who asked for this" story.
- PRs that change the wire protocol without version-bumping or updating `docs/BUILD-YOUR-OWN-BACKEND.md`.
- PRs that add dependencies when a 30-line alternative exists.
