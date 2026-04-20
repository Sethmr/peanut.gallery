<!-- ═══════════════════════════════════════════════════════════════════ -->
<!-- 🔒 PROTECTED FILE — only @Sethmr can edit this.                     -->
<!-- External PRs touching this file will be auto-closed by              -->
<!-- .github/workflows/protect-ai-instructions.yml                       -->
<!-- Full policy: docs/AI-INSTRUCTIONS-POLICY.md                         -->
<!-- ═══════════════════════════════════════════════════════════════════ -->

> **🔒 Protected file.** External PRs that change this file will be auto-closed. Open an issue to request a change — see [`AI-INSTRUCTIONS-POLICY.md`](AI-INSTRUCTIONS-POLICY.md).

# Release Pipeline — Branch Model + Self-Merge Contract

**Last updated:** 2026-04-20. Branching model reset: `release/*` is now the only path into `main`; hotfixes route through `develop` instead of branching off `main`; no more back-merges.

Everything else about how to contribute (commit style, pre-merge checks, PR shape, non-negotiables, git-lock rule) lives where it already lived — [`.github/CONTRIBUTING.md`](../.github/CONTRIBUTING.md), [`.github/PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md), [`CLAUDE.md`](../CLAUDE.md), [`AI-GIT-PROTOCOL.md`](AI-GIT-PROTOCOL.md). This file only documents what's **new**.

## Branch model (diagram)

```
Normal work:
  feature/* ─► develop ─► release/vX.Y.Z ─► main ─► tag + CWS zip
                                    │
                                    └─► preserved forever (legacy testing)

Hotfixes:
  hotfix/*  ─► develop ─► release/vX.Y.(Z+1) ─► main ─► tag + CWS zip

Never:
  hotfix/*  ─► main      (no direct-to-main PRs)
  main      ─► develop   (no back-merge)
```

`release/*` branches are **never deleted** — every shipped version keeps its branch forever so legacy testing can check out any tag's exact build context. `main` and `release/*` share commit SHAs for release-sourced work (rebase/ff merge, never squash).

## The 4 rules

1. **`main`** = production + occasionally intermediate versions that never shipped to CWS (Seth iterates fast; a newer version sometimes lands before the previous one goes out) + historical record of every finalized version.
2. **All `main` merges come from `release/vX.Y.Z`.** `release/*` is cut from `develop`, then rebased or fast-forwarded onto `main` so `main` and `develop` stay commit-identical for release-sourced commits.
3. **Feature / bugfix / research work** = cut from `develop`, PR back to `develop`, merged (squash), branch deleted. Seth doesn't review develop-facing PRs.
4. **Only persistent branches are `develop`, `main`, and `release/*`.** Every release's `release/*` branch is preserved forever. Feature branches (including `hotfix/*`) are deleted on merge.

## Branch lifecycle reference

| Branch | Cut from | Merged to | Merge method | Deleted after merge? | Notes |
|---|---|---|---|---|---|
| `develop` | — | — | — | No | Long-lived integration trunk. Claude self-merges here under the contract below. |
| `main` | — | — | — | No | Long-lived. Only `release/*` lands here. 1 approval required, linear history, signed commits. |
| `release/vX.Y.Z` | `develop` | `main` | rebase-and-merge **or** fast-forward (never squash) | **No — preserved forever** | Holds the manifest bump + CHANGELOG entry. Shares SHAs with `main` and `develop` post-merge. |
| `feature/*` (also `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`, `test/`, `ci/`) | `develop` | `develop` | squash | Yes | Claude can self-merge on green `npm run check` + self-merge contract below. |
| `hotfix/*` | `develop` | `develop` | squash | Yes | Ships to `main` via the next `release/vX.Y.(Z+1)`. No direct-to-main PRs. |

## Release workflow — step by step

1. **Gate check.** `develop` green? `npm run check` clean (typecheck + extension lint + director fixtures)? CI passing? No stranded in-flight hotfix that should ride with this release?
2. **Sync local develop.** `git checkout develop && git pull --ff-only`.
3. **Cut the release branch.**
   - `git checkout -b release/vX.Y.Z`
   - Bump `"version"` in [`extension/manifest.json`](../extension/manifest.json).
   - Update [`CHANGELOG.md`](../CHANGELOG.md): add a `## [X.Y.Z] — YYYY-MM-DD` header, then grouped bullets by commit type (`### Added` / `### Changed` / `### Fixed` / `### Docs` / `### Chore`) summarizing the `develop` commits since the previous release. Move matching entries out of `## [Unreleased]`.
   - Commit with prefix `release:` — message body explains the scope of this version and anything operationally interesting about it. Trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` on Claude-authored commits.
4. **Push + open the `main` PR.** `git push -u origin release/vX.Y.Z`. Then:
   - `gh pr create --base main --head release/vX.Y.Z --title "release: vX.Y.Z — <codename>" --body-file <CHANGELOG-delta.md>`
   - Body = the CHANGELOG entry, grouped by type. Draft if anything is still canary; otherwise ready-to-merge.
5. **Merge method.** **Rebase-and-merge** (preserves individual commit SHAs on `main`) **or** fast-forward if `main` is a strict ancestor of `develop` (usually is under this model). **Never squash** — squashing breaks the SHA identity between `main`, `develop`, and `release/*` that rule #2 depends on. Seth merges; Claude cannot (branch protection + `.claude/settings.json` deny list).
6. **Tag on `main`.** `git tag -a vX.Y.Z -m "vX.Y.Z — <codename>" <main-sha>` then `git push origin vX.Y.Z`. **Do NOT delete `release/vX.Y.Z`** — it stays forever. Feature branches on the other hand get deleted on squash-merge.
7. **CWS upload.** Build + upload the `.zip` per [`OPS.md`](OPS.md). Or **skip** if a newer version is already ready — that's the "intermediate versioning" case from rule #1: the tag exists on `main` for the historical record, the CWS just skips to the newest version.

## Hotfix workflow

Seth's 2026-04-20 decision: **hotfixes route through `develop`, not through `main`.** Tradeoff: slower urgent-fix latency in exchange for perfectly linear history between `main` and `develop`. Worth it.

1. **Sync.** `git checkout develop && git pull --ff-only`.
2. **Branch.** `git checkout -b hotfix/<slug>`.
3. **Fix + test.** Commit with the appropriate conventional-commit prefix (`fix:` is typical). Same commit-message contract as any other Claude-authored work: why + alternatives considered + Co-Authored-By trailer.
4. **PR → `develop`.** `gh pr create --base develop --head hotfix/<slug>`. Merge (squash) once `npm run check` and CI are green. Squash-merge deletes the branch.
5. **Ship via a new release.** Cut `release/vX.Y.(Z+1)` from `develop` and follow the release workflow above. The hotfix reaches `main` as part of that release PR.
6. **If the fix is genuinely production-down and can't wait for a release cycle:** flag it to Seth in-session. The documented flow routes through `develop`. Do **not** improvise a direct-to-main hotfix PR without Seth's explicit override in the current conversation. Under the new model there's no expected direct-to-main path at all; if Seth greenlights one as an emergency, the PR will still need to slip past [`protect-main-branch.yml`](../.github/workflows/protect-main-branch.yml) (@Sethmr is a carve-out; the current `hotfix/*` head-branch carve-out also still exists as legacy), and how the fix back-fills to `develop` afterwards is Seth's call.

## Claude's self-merge contract on `develop`

Seth's ask, 2026-04-19 verbatim: *"I am fine with Claude self-merging into develop so long as everything it's doing is documented to the point it can explain why it did what it did in a fresh context window."*

Before a Claude-authored PR self-merges into `develop`, all of the following must be true:

1. `npm run check` passes locally (typecheck + extension lint + director fixtures).
2. The commit body contains the **why** and the **alternatives considered**, not just the what. Per [`CONTRIBUTING.md § Commit style`](../.github/CONTRIBUTING.md#commit-style).
3. The PR body fills every field of [`PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md) — especially the "How" section (why X over Y) and the Risk tier.
4. Any decision that isn't recoverable from the diff is linked to a session-note, memory file, issue, or design doc. Fresh-Claude reads those.
5. Every Claude-authored commit carries the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer. The merge-checklist bot's skip logic depends on it — missing trailer means the bot spams every push.
6. If any of the above can't be met, **stop self-merging** — leave the PR open and pull Seth in.

If in doubt, treat the PR as if it targets `main` and needs Seth's eyes anyway.

## What counts as release-worthy

Claude proactively drafts the `release/vX.Y.Z → main` PR as soon as `develop` crosses the threshold. Seth doesn't ask; the button should already be waiting.

- Any user-visible feature landing on `develop` (a `feat:` commit that ships behavior to the extension or backend).
- A bundle of `fix:` commits that closes ≥1 known issue and stabilizes a flow.
- A documentation pass that materially changes how a contributor or self-host operator works (new architecture doc, new install path, breaking change to the backend wire-spec).
- A coordinated chore set worth versioning (e.g. a release-pipeline change — workflow + docs + settings together).

If the next thing on `develop` is a single-line typo fix or an unverified canary commit, **don't** cut a release yet. Wait until there's something worth Seth's review attention.

## Tool-level defense-in-depth

[`.claude/settings.json`](../.claude/settings.json) deny-lists the destructive commands: direct push to `main`/`master`, force push, hard reset, branch/tag/release/repo deletions. Belt to branch protection's suspenders — fails fast inside the Claude Code session before GitHub ever sees the command.

## PR-time enforcement

Three workflows run the checks Seth used to do by hand:

- [`.github/workflows/pr-checklist-comment.yml`](../.github/workflows/pr-checklist-comment.yml) posts a fresh comment on every PR open + every new commit, telling the author exactly what needs to be true to merge. Comment text links the canonical docs (this file, CONTRIBUTING.md, AI-GIT-PROTOCOL.md, the upgrade policy) instead of duplicating them. Skips Claude-authored PRs by default (detection: Co-Authored-By trailer on every commit; escape hatch `<!-- bot-review -->` in the PR body); flags Dependabot PRs with the framework-upgrade heads-up inline; adds `main`-only gates (CODEOWNERS approval, CHANGELOG, tag plan) when the PR targets `main`.
- [`.github/workflows/protect-main-branch.yml`](../.github/workflows/protect-main-branch.yml) auto-closes any PR targeting `main` that isn't a release-flow PR. Carve-outs: @Sethmr (release author), `dependabot[bot]` (pre-existing in-flight PRs — new ones target `develop` per `dependabot.yml`), and head branches matching `develop` or `hotfix/*`. **Under the new model these carve-outs need updating to allow `release/*` and drop `hotfix/*`** — the workflow file is in the protected-paths regex, so Seth has to make that edit; Claude can't. Until then, release PRs work because they're authored by @Sethmr, which is already a carve-out.
- [`.github/workflows/claude-triage.yml`](../.github/workflows/claude-triage.yml) fires fresh-Claude on Dependabot PRs and emits a single triage verdict comment — MERGE-NOW / QUEUE-AND-CLOSE / NEEDS-HUMAN — following [`BOT-TRIAGE-RUBRIC.md`](BOT-TRIAGE-RUBRIC.md). Requires `ANTHROPIC_API_KEY` repo secret ([`GITHUB-MANUAL-STEPS.md § 16`](GITHUB-MANUAL-STEPS.md#16-add-anthropic_api_key-repo-secret-for-claude-triage-bot)).

## Manual setup Seth still owns

Branch protection rules live in the GitHub web UI. Click-path for both rules (and the new `release/*` carve-out) is in [`GITHUB-MANUAL-STEPS.md § 8`](GITHUB-MANUAL-STEPS.md#8-branch-protection--asymmetric-main-strict-develop-lighter).

## Superseded patterns — historical note

Before 2026-04-20 this repo used a different shape:

- **Old release flow:** PR directly from `develop → main` (no intermediate `release/*` branch). Merge-commit style.
- **Old hotfix flow:** branch `hotfix/*` off `main`, PR back to `main`, then back-merge `main → develop` as a follow-up PR.
- **Old diff pattern:** "diff develop vs main, PR the delta to a `hotfix/*` branch off main" — used briefly during the transition from the merge-commit era.

All three were retired once the CWS release cadence stabilized and the messy rebases from back-merges stopped being worth the latency savings. Anyone reading the git log for hotfixes dated before 2026-04-20 will see the older pattern — that's fine, it's history. Don't use it going forward.

Claude's auto-memory has been updated to match ([feedback_backmerge_main_to_develop.md](../../.claude/memory/feedback_backmerge_main_to_develop.md) in Seth's personal memory, referenced in-session).
