# Release Pipeline — Branch Model + Self-Merge Contract

**Last updated:** 2026-04-19. Introduces the `develop → main` split + `.claude/settings.json` deny list.

Everything else about how to contribute (commit style, pre-merge checks, PR shape, non-negotiables, git-lock rule) lives where it already lived — [`.github/CONTRIBUTING.md`](../.github/CONTRIBUTING.md), [`.github/PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md), [`CLAUDE.md`](../CLAUDE.md), [`AI-GIT-PROTOCOL.md`](AI-GIT-PROTOCOL.md). This file only documents what's **new**.

## Branch model

```
feature/* ─► develop ─► main ─► tag + CWS zip
```

| Branch | Who merges in | Protection |
|---|---|---|
| `main` | **Only Seth**, via PR from `develop`. This is a release. | PR required; 1 approval required (keeps Claude out even with write access); linear history; signed commits; include admins; no force push, no deletion. |
| `develop` | **Claude self-merges** from `feature/*` / `fix/*` / `chore/*` / `docs/*` after `npm run check` passes and the PR meets the self-merge contract below. Seth also merges here when convenient. | PR required; **no approval required** (this is what enables the asymmetry); linear history; signed commits; no force push, no deletion. |
| `feature/*` etc. | Anyone. Deleted after merge. | None. |

## Claude's self-merge contract

Seth's ask, 2026-04-19 verbatim: *"I am fine with Claude self-merging into develop so long as everything it's doing is documented to the point it can explain why it did what it did in a fresh context window."*

Before a Claude-authored PR self-merges into `develop`, all of the following must be true:

1. `npm run check` passes locally (typecheck + extension lint + director fixtures).
2. The commit body contains the **why** and the **alternatives considered**, not just the what. Per [`CONTRIBUTING.md § Commit style`](../.github/CONTRIBUTING.md#commit-style).
3. The PR body fills every field of [`PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md) — especially the "How" section (why X over Y) and the Risk tier.
4. Any decision that isn't recoverable from the diff is linked to a session-note, memory file, issue, or design doc. Fresh-Claude reads those.
5. If any of the above can't be met, **stop self-merging** — leave the PR open and pull Seth in.

If in doubt, treat the PR as if it targets `main` and needs Seth's eyes anyway.

## Release flow — `develop` → `main`

**Claude proactively drafts the release PR.** Seth doesn't ask. As soon as a batch of work on `develop` crosses a release-worthy threshold (one obvious feature, a meaningful bundle of fixes, or a documentation pass that's worth versioning), Claude opens the `develop → main` PR so Seth has a "review + merge" button waiting whenever he's next at the keyboard. The judgment of "release-worthy" is Claude's call to make — see "What counts as release-worthy" below; when in doubt, draft it as a PR with a clear title + body and let Seth weigh in.

1. Gate check: `develop` green? No stranded hotfix on `main`?
2. Skim `git log main..develop --oneline` + `git diff main..develop`.
3. `gh pr create --base main --head develop --title "release: vX.Y.Z — <codename>"`. Body = CHANGELOG entry, grouped by `feat:` / `fix:` / `docs:` / `chore:` from the commits being released. Mark the PR `draft` if there's any reason Seth might want to wait (still-canary work, pending hotfix, etc.) — otherwise open it ready-to-merge.
4. **Seth merges.** (Claude cannot — branch protection + `.claude/settings.json` both block.)
5. Tag: `git tag -a vX.Y.Z -m "..."` + `git push origin vX.Y.Z`.
6. Build + upload the CWS zip per [`OPS.md`](OPS.md).
7. Back-merge `main → develop` if the release PR got amended on `main`.

### What counts as release-worthy

- Any user-visible feature landing on `develop` (a `feat:` commit that ships behavior to the extension or backend).
- A bundle of `fix:` commits that closes ≥1 known issue and stabilizes a flow.
- A documentation pass that materially changes how a contributor or self-host operator works (think: new architecture doc, new install path, breaking change to the backend wire-spec).
- A coordinated chore set worth versioning (e.g. this very release-pipeline change — workflow + docs + settings together).

If the next thing on `develop` is a single-line typo fix or an unverified canary commit, **don't** open the release PR yet. Wait until there's something worth Seth's review attention.

## Hotfixes (direct-to-main)

Branch off `main` → `hotfix/<slug>` → PR → `main`. **Seth merges.** Tag. Ship. Claude's follow-up: PR `main → develop` as `chore: back-merge hotfix vX.Y.Z`.

Claude never hotfixes directly to `main`. If Seth is away, Claude prepares the PR and pings.

## Tool-level defense-in-depth

[`.claude/settings.json`](../.claude/settings.json) deny-lists the destructive commands: direct push to `main`/`master`, force push, hard reset, branch/tag/release/repo deletions. This is the belt to branch protection's suspenders — it fails fast inside the Claude Code session before GitHub ever sees the command.

## PR-time enforcement

[`.github/workflows/pr-checklist-comment.yml`](../.github/workflows/pr-checklist-comment.yml) posts a fresh comment on every PR open + every new commit, telling the author exactly what needs to be true to merge. Comment text links the canonical docs (this file, CONTRIBUTING.md, AI-GIT-PROTOCOL.md, the upgrade policy) instead of duplicating them — when the rules change here, the comment changes by reference. The workflow also flags Dependabot PRs with the framework-upgrade triage rubric, and adds `main`-only gates (CODEOWNERS approval, CHANGELOG, tag plan) when the PR targets `main`.

## Manual setup Seth still owns

Branch protection rules live in the GitHub web UI. The exact click-path — both rules, copy-paste — is in [`GITHUB-MANUAL-STEPS.md § 8`](GITHUB-MANUAL-STEPS.md#8-branch-protection--asymmetric-main-strict-develop-lighter).
