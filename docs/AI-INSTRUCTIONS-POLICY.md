<!-- ═══════════════════════════════════════════════════════════════════ -->
<!-- 🔒 PROTECTED FILE — only @Sethmr can edit this.                     -->
<!-- External PRs touching this file will be auto-closed by              -->
<!-- .github/workflows/protect-ai-instructions.yml                       -->
<!-- ═══════════════════════════════════════════════════════════════════ -->

> **🔒 Protected file.** External PRs that change this file will be auto-closed. Open an issue to request a change instead.

# AI Instructions — Protection Policy

**Last updated:** 2026-04-20. Originally born 2026-04-19 when Seth wired the first webhook-triggered Claude into the repo; the protected set was re-confirmed this pass after the webhook kickoff path was retired in favor of a local daemon ([`scripts/linear-daemon.ts`](../scripts/linear-daemon.ts)). The policy itself — who may edit, what's protected, how change requests work — is unchanged.

## TL;DR

Files that tell an AI bot how to behave inside this repo are **owned exclusively by @Sethmr**. External PRs that touch them are auto-closed by [`.github/workflows/protect-ai-instructions.yml`](../.github/workflows/protect-ai-instructions.yml).

If you think one of these files should change, **open an issue** describing the change and why. Seth will make the edit himself if he agrees.

This is a security posture, not a judgment of contributors. Modifying instruction files could inject prompts into bots, weaken safety gates, or bypass review automation — so we keep that surface small and visibly protected.

---

## What is protected

The current protected set:

| Path | Why it's protected |
|---|---|
| `CLAUDE.md` | Top-level rules every Claude instance reads first. |
| `.claude/**` | Claude Code permission settings (deny-list of destructive commands, etc.). |
| `.github/CODEOWNERS` | Defines who must review what — protecting itself prevents bypass. |
| `.github/dependabot.yml` | Controls what dependency PRs enter the repo (and the ignore rules that defend the framework-experiments policy). |
| `.github/workflows/**` | Any workflow could execute Claude or other automation; the workflow file is the system prompt. |
| `docs/AI-GIT-PROTOCOL.md` | The git-write rules every AI follows in this sandbox. |
| `docs/AI-INSTRUCTIONS-POLICY.md` | This file. Self-protection. |
| `docs/BOT-TRIAGE-RUBRIC.md` | The decision tree fresh-Claude reads when triaging Dependabot PRs. |
| `docs/RELEASE.md` | Branch model, self-merge contract, release flow — load-bearing for what bots will and won't do. |

The canonical list lives in [`.github/workflows/protect-ai-instructions.yml`](../.github/workflows/protect-ai-instructions.yml). When in doubt, that workflow is the source of truth — this table is documentation, the regex is law.

## What is NOT protected

Most of the repo. In particular:

- **Persona content** — `lib/packs/*/personas.ts`, `docs/packs/*/RESEARCH.md`. We welcome PRs that add character research, refine voice, or contribute new packs. Seth reviews these for fit, but they're open territory.
- **Extension code** — `extension/`, `app/`, `lib/`, `scripts/`. Normal contribution flow.
- **Documentation that isn't AI-instructional** — `README.md`, `docs/CONTEXT.md`, `docs/CHANGELOG.md`, `docs/ROADMAP.md` (the product roadmap, not bot policy), session notes, install guides.
- **GitHub community files** — `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, issue/PR templates.

If your PR doesn't touch the protected set, it goes through the normal merge flow ([PR-checklist bot](../.github/workflows/pr-checklist-comment.yml) → Seth's review → merge).

## How to request a change to a protected file

1. **Open an issue** with the `type: docs` or `type: security` label. Title it clearly: `[AI-instructions] proposed change to <file>`.
2. **Describe the change and the reason.** Include the diff you'd want to apply if it helps.
3. **Wait for Seth.** He'll evaluate, push back if the change weakens the security posture, and make the edit himself if he agrees.

Why an issue and not a PR you can copy-paste from? Because the act of approving the diff is what we're protecting. A PR makes it cheap to merge; an issue forces Seth to author the change deliberately.

## How the auto-reject works

[`.github/workflows/protect-ai-instructions.yml`](../.github/workflows/protect-ai-instructions.yml) runs on `pull_request_target` (so it can comment + close even on first-time-contributor PRs):

1. Lists every file touched by the PR.
2. Matches against the protected-paths regex.
3. If any matches **and** the author is not `@Sethmr` (and is not `dependabot[bot]` doing a workflow version bump):
   - Posts a kind explanation comment with the protected files highlighted.
   - Closes the PR.
4. If no protected files are touched, exits silently and lets the normal PR flow proceed.

The `pull_request_target` trigger is intentional — it has the write permissions needed to close, and it cannot be modified by the PR being evaluated (the workflow file is frozen at the base-branch version). See the workflow file's header comment for the full security rationale.

## Carve-outs

- **Dependabot** can edit files under `.github/workflows/**` (action version bumps only). This is required — otherwise Dependabot can't keep `actions/checkout`, `anthropics/claude-code-action`, etc. fresh. Dependabot cannot edit any non-workflow protected file (e.g., it cannot bump version strings inside `CLAUDE.md`).
- **Branch protection on `main` and `develop`** has CODEOWNERS review required as a defense-in-depth layer (see [`GITHUB-MANUAL-STEPS.md § 8`](GITHUB-MANUAL-STEPS.md#8-branch-protection-for-main)). Even if the auto-reject workflow ever fails or is disabled, an unauthorized edit to a protected file can't merge without @Sethmr's explicit approval.

## Why visible protection

You'll see two markers on every protected file:

1. **An HTML-comment banner at the top** — invisible in rendered Markdown but visible in raw view (and in code editors). This is the "I noticed before I started typing" warning.
2. **A blockquote banner** in rendered Markdown — visible when reading the doc on GitHub. This is the "I noticed when I clicked the file" warning.

For non-Markdown files (workflows, CODEOWNERS), the same warning is in `#` comments at the top.

The goal is for any contributor inspecting these files to know — before they invest effort — that a PR against them will be auto-closed.

## Audit log

Changes to the protected set itself (this file, the workflow, CODEOWNERS) are visible in `git log` and require @Sethmr to author. If the protection ever weakens unexpectedly, `git log --follow` on each protected file will show when and why.

## When this policy may relax

If a co-maintainer joins the project, their handle will be added to the allowed-author list with the same authority as @Sethmr. There is no current plan to delegate protected-file edit authority to a bot account — the protection is specifically about preventing automated or third-party prompt injection.
