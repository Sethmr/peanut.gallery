# Manual GitHub Steps — Page Architecture Audit Follow-ups

Everything in this document has to happen in the GitHub web UI (or via `gh` from your real terminal). The sandbox I run in doesn't have `gh` or repo-settings access. Ordered by impact — top items are the ones that change how the repo reads to Jason or a drive-by visitor.

**Last updated:** 2026-04-19 (post page-architecture audit)

---

## Priority 0 — visible on the repo front page

These are the first things a first-time visitor sees.

### 1. Set the repo "About" card

Go to `github.com/Sethmr/peanut.gallery` → gear icon next to "About" (top right). Fill:

- **Description:** `An AI writers' room in your Chrome side panel. Four personas watch YouTube with you and react in real time.`
- **Website:** `https://www.peanutgallery.live`
- **Topics:** `chrome-extension`, `ai`, `youtube`, `anthropic`, `xai`, `deepgram`, `podcast`, `side-panel`, `manifest-v3`, `sse`, `next-js`, `twist`
- **Include in the home page:** keep Releases + Packages off, turn Issues ON, Discussions ON (after step 2), Wiki OFF.

### 2. Turn on Discussions

Settings → General → Features → check **Discussions**.

Once on, seed three starter categories (Discussions → gear icon):

- **Ideas** — persona pack requests that aren't fully formed, roadmap vibes, "has anyone tried X?"
- **Show & Tell** — self-hosted backends, custom packs, fun sessions.
- **Help** — usage questions that don't belong in issues.

Link `.github/SUPPORT.md` pushes visitors there. No Discussions tab = dead link.

### 3. Upload a social preview image

Settings → General → Social preview → upload a 1280×640 card. The tabloid masthead + "🥜 Peanut Gallery" + the four persona mugshots makes the best first impression. Claude Design can generate one against `marketing/CLAUDE-DESIGN-BRIEF.md` if you don't have one handy.

Missing image = GitHub's auto-generated "code is my life" card, which looks generic and hurts social-share CTR.

### 4. Pin the right repositories on your profile

`github.com/Sethmr` → Customize your pins. Put `peanut.gallery` first. `peanut.gallery.site` second. Leave older iOS projects in the long tail. The TWiST bounty audience is going to land on your profile — make the pin order tell the story.

---

## Priority 1 — labels, milestones, project boards

### 5. Rebuild the label set

Issues → Labels. Delete the defaults (`good first issue`, `help wanted`, `bug`, etc. — keep those three, delete the rest) and add the following. The label palette should read like a product roadmap, not a GitHub default install.

**Type labels (teal):**

- `type: bug` — something is broken
- `type: feature` — new capability
- `type: pack` — new or tweaked persona pack
- `type: docs` — README / CONTRIBUTING / roadmap / self-host guide
- `type: security`
- `type: ux` — side panel flows, keyboard nav, focus order

**Area labels (purple):**

- `area: extension` — `extension/` only
- `area: director` — routing / cascade / fixtures
- `area: backend` — `app/api/*`
- `area: packs` — `lib/packs/*`
- `area: voice` — v1.6 TTS work
- `area: site` — marketing site

**Priority labels (red → grey):**

- `priority: p0` — drop everything
- `priority: p1` — next release
- `priority: p2` — someday

**Release milestone** one per: v1.5.1, v1.6.0, v1.7.0, v1.8.0, v2.0.0.

The `gh` command can script this from your real terminal if you don't want to click through it:

```bash
gh label create "type: bug" --color d73a4a --description "Something is broken" --force
gh label create "type: feature" --color 0e8a16 --description "New capability" --force
gh label create "type: pack" --color 5319e7 --description "New or tweaked persona pack" --force
# …etc for each label
```

### 6. Create the v1.5.1 milestone and attach remaining v1.5.0 work

Issues → Milestones → New milestone → `v1.5.1 — Smart Director Polish` → due ~2 weeks out.

Move the pending v1.5.0 canary tasks into it (steps 1-6 of [`ROADMAP.md#in-flight`](ROADMAP.md#in-flight--v150-canary--tag--cws-upload)) as either checklist items on a single tracking issue or as separate issues.

### 7. Enable a simple project board (optional but worth it)

Projects → New project → Board view → columns: `Backlog` / `Next release` / `In progress` / `Shipped`. Link every Priority issue.

Keeps the "what's next" story visible on the repo without requiring someone to read ROADMAP.md.

---

## Priority 2 — governance

### 8. Branch protection — asymmetric (`main` strict, `develop` lighter)

Wires the `develop → main` model from [`RELEASE.md`](RELEASE.md) into GitHub's enforcement layer. Two rules — copy-paste each.

**Rule 1 — `main`.** Settings → Branches → Add rule → pattern `main`:

- [x] Require pull request before merging
- [x] **Require approvals: 1** ← keeps Claude out of `main` even with write access
- [x] Dismiss stale approvals on new commits
- [x] Require review from Code Owners
- [x] Require linear history
- [x] Require signed commits
- [x] Include administrators
- [ ] Allow force pushes — off
- [ ] Allow deletions — off

**Rule 2 — `develop`.** Same page → Add another rule → pattern `develop`:

- [x] Require pull request before merging
- [ ] Require approvals — off ← what enables Claude's self-merge
- [x] **Require review from Code Owners** ← second gate on AI-instruction files; the auto-reject workflow is the first
- [x] Require linear history
- [x] Require signed commits
- [x] Include administrators
- [ ] Allow force pushes — off
- [ ] Allow deletions — off

The "Require review from Code Owners" box on **both** rules is what makes [`CODEOWNERS`](../.github/CODEOWNERS) load-bearing for AI-instruction protection. It's defense-in-depth: [`protect-ai-instructions.yml`](../.github/workflows/protect-ai-instructions.yml) is the primary gate (auto-closes external PRs touching protected paths); CODEOWNERS is the fallback in the unlikely case that workflow is ever disabled. Without this checkbox, CODEOWNERS becomes advisory rather than enforced.

No status checks required yet — CI is intentionally local-only. `.claude/settings.json` handles tool-level defense. If/when CI lands, add it as a required check on both rules.

### 9. Enable Sponsors

Settings → Features → Sponsorship → Set up GitHub Sponsors.

`.github/FUNDING.yml` already lists `github: [Sethmr]` + a custom URL. Once your Sponsors profile is live, the ❤️ Sponsor button will appear on the repo.

If you don't want to set up Sponsors yet, drop `FUNDING.yml` or set both fields to null. The button-with-no-target state is the worst of both worlds.

### 10. Turn on security features

Settings → Code security and analysis:

- [x] Dependency graph
- [x] Dependabot alerts
- [x] Dependabot security updates
- [x] Secret scanning + push protection

These all cost nothing and protect you from the two most common public-repo footguns (leaked keys, vulnerable deps). `dependabot.yml` in `.github/` already configures the weekly PR cadence.

### 11. Release automation (optional, future)

If you want tagged releases to auto-zip the CWS artifact, that's a CI concern (GitHub Actions). Per the page-architecture audit scope, no workflow files are committed today. Add one in a follow-up PR if the manual zip-and-upload is becoming a chore.

---

## Priority 3 — linkable assets

### 12. Upload the narrated walkthrough thumbnail

The ROADMAP references `https://youtu.be/WPyknI7-N5U`. Make sure the YouTube video:

- Has a custom thumbnail (masthead + side panel screenshot).
- Is listed Public.
- Has chapters in the description corresponding to the 5 sections of the walkthrough.

The marketing site and ROADMAP both treat it as source-of-truth; bad thumbnail = bad social share.

### 13. Pin the key issues + PRs

On the repo's Issues tab, pin:

- The v1.5.0 canary tracking issue (once created).
- Any "good first issue" that represents an accurate first contribution (pack request templates ship great first issues).
- The bounty-tracking issue if one exists.

---

## Priority 4 — nits

### 14. Replace the default README social card on old commits

If the repo's `main` branch predates the README rewrite you just landed, social shares of older commit SHAs will pull old metadata. GitHub caches aggressively; force a re-crawl by sharing a fresh commit URL once, then unshare. Minor.

### 15. Check the `www.peanutgallery.live` `<head>` for GitHub-repo Open Graph

The marketing site at `www.peanutgallery.live` should link to this repo with proper `og:` metadata. That's cross-repo (`Sethmr/peanut.gallery.site`), not this one. Track separately if it's not already on the site's backlog.

---

## Priority 1.5 — Claude triage bot setup

### 16. Add `ANTHROPIC_API_KEY` repo secret (for Claude triage bot)

Without this secret, [`.github/workflows/claude-triage.yml`](../.github/workflows/claude-triage.yml) cannot fire — the workflow falls silent and Dependabot PRs will only get the regular PR-checklist comment. Nothing breaks, but the auto-triage doesn't happen.

**Exact path:** `github.com/Sethmr/peanut.gallery` → Settings → Secrets and variables → Actions → **New repository secret**.

- **Name:** `ANTHROPIC_API_KEY` (exact string, case-sensitive)
- **Value:** paste from [console.anthropic.com](https://console.anthropic.com/) → Settings → API Keys. Create a fresh key named `peanut.gallery triage bot` so it's easy to revoke independently if needed.

**Why a repo Actions secret (not a Dependabot secret, not env var):**

- The triage workflow uses `pull_request_target`, which runs the workflow file from the **base branch** and has access to repo Actions secrets — even on PRs from forks and even on Dependabot PRs (which by default have zero Actions-secret access on plain `pull_request` events).
- GitHub encrypts secrets at rest with libsodium, only decrypts them at workflow-run time, and auto-redacts the value from every line of workflow logs. The key is injected as an env var into the `claude-code-action` runtime; the value is NEVER passed into the `prompt:` field and NEVER printed anywhere.
- A malicious or compromised PR cannot modify the workflow file to exfiltrate the secret, because the workflow is frozen at the base-branch version under `pull_request_target`.

**Open-source safety checklist (one-time):**

- [ ] Confirm the secret is scoped to **Actions**, not to **Codespaces** or **Dependabot** tabs (those are separate stores — adding it elsewhere doesn't help and clutters your secrets UI).
- [ ] Do NOT add the secret to any workflow's `env:` block or `inputs:` — only pass it via `${{ secrets.ANTHROPIC_API_KEY }}` into the action's `anthropic_api_key:` parameter.
- [ ] Do NOT echo or print the secret anywhere, even for debugging.
- [ ] Enable branch protection on `main` and `develop` (step 8) before flipping this on — that prevents a malicious PR from landing a workflow edit without review.

**Cost discipline:**

- Each triage run is capped at `--max-turns 5`. Typical run: $0.05–$0.15 in API tokens.
- Dependabot cadence is weekly, usually 2–5 PRs per run. Budget: under $5/month under normal cadence.
- Set a hard monthly spend cap on the key in console.anthropic.com → Billing → Limits if you want belt-and-suspenders.

**To rotate:**

1. Generate new key in console.anthropic.com → API Keys.
2. Update this secret (same name, new value). GitHub preserves the name and swaps the value.
3. Delete the old key in console.anthropic.com. Any still-running workflow using the old value will fail; new workflow runs pick up the new value immediately.

**To kill-switch:**

- Delete the secret (Settings → Secrets and variables → Actions → `ANTHROPIC_API_KEY` → trash icon). The workflow will fail on the next Dependabot PR with a clear "anthropic_api_key is required" error. Nothing else breaks.
- Or disable the workflow entirely: Actions tab → "Claude Triage" → `…` → Disable workflow.

---

## What I handled for you (no action needed)

These are committed in `chrome-extension/` and landed as part of the audit:

- README rewrite — Jason-grade hero, badges, `www.peanutgallery.live` references, web-app framing de-emphasized.
- ROADMAP refresh — v1.5.0 "The Broadsheet" marked feature-complete with the canary + CWS upload gates spelled out.
- New pages: `AUTHORS.md`, `.github/SUPPORT.md`.
- `.github/CONTRIBUTING.md` trimmed (no stale CI-workflow references).
- `.github/CODE_OF_CONDUCT.md`, `SECURITY.md`, `FUNDING.yml`, `CODEOWNERS`, issue templates, PR template — all already in place from the earlier pass.
- `docs/INDEX.md` + `docs/CONTEXT.md` + `docs/SELF-HOST-INSTALL.md` + `docs/BUILD-YOUR-OWN-BACKEND.md` + `docs/ROADMAP.md` — URL references updated to reflect `www.peanutgallery.live` (marketing) + `api.peanutgallery.live` (backend) split.
- `.github/dependabot.yml` — shrunk to the npm block (dropped the github-actions block since no workflows ship).

---

## Deliberately out of scope

Per Seth's audit reframe: **this audit is about GitHub-facing pages architecture, not code automation.** Items explicitly not touched:

- CodeQL / security scanning workflows — nothing shipped.
- Release-tagging automation — manual for now.
- Lint / test automation in CI — pre-PR local checks only; Seth runs them before merge.

One deliberate exception (added 2026-04-19 on Seth's direct ask): `.github/workflows/pr-checklist-comment.yml` posts a fresh merge-requirements comment on every PR open + every new commit. It doesn't run tests or gate anything — pure signal to the author about what needs to be true to land. Rules live in `docs/RELEASE.md`; the comment links rather than duplicates. `.github/dependabot.yml` now also tracks the `github-actions` ecosystem weekly so the action versions used here stay current.

Second deliberate exception (also 2026-04-19, Seth's direct ask): `.github/workflows/claude-triage.yml` fires fresh-Claude on Dependabot PRs for triage (comment-only first iteration, per [`BOT-TRIAGE-RUBRIC.md`](BOT-TRIAGE-RUBRIC.md)).

Third deliberate exception (also 2026-04-19): `.github/workflows/protect-ai-instructions.yml` auto-closes external PRs that touch AI-instruction files (CLAUDE.md, .claude/, CODEOWNERS, dependabot.yml, .github/workflows/, the four AI-facing docs under docs/). These files tell AI bots how to behave; letting external PRs edit them is a prompt-injection / safety-bypass risk. Full policy: [`AI-INSTRUCTIONS-POLICY.md`](AI-INSTRUCTIONS-POLICY.md). The auto-close is the first gate; CODEOWNERS + branch protection (step 8) is the second.

If/when broader code automation is in scope, the code-quality audit is a separate conversation — this doc stays page-architecture-only.
