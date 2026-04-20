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

Wires the `release/* → main` branching model from [`RELEASE.md`](RELEASE.md) into GitHub's enforcement layer. Two rules — copy-paste each. (If you previously configured these under the `develop → main` shape, the GitHub Settings rules themselves don't need to change — `main` and `develop` branch-protection are identical under both models. The head-branch carve-outs are enforced separately by [`protect-main-branch.yml`](../.github/workflows/protect-main-branch.yml); that workflow's regex still allows `develop` + `hotfix/*` and needs a Seth-owned edit to allow `release/*`.)

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

---

## Priority 1.6 — Linear → Claude Code kickoff pipeline

### 17. Wire Linear "Todo" transition → kickoff-Claude PR

Fires fresh-Claude inside [`.github/workflows/claude-kickoff.yml`](../.github/workflows/claude-kickoff.yml) when a Linear issue transitions into a state of type `unstarted` (i.e. the "Todo" column). The handler at [`/api/linear-webhook`](../app/api/linear-webhook/route.ts) verifies Linear's HMAC signature, rate-limits, and dispatches a `repository_dispatch` event at GitHub. Kickoff-Claude implements the ticket on a fresh `claude/<identifier>-<slug>` branch, runs `npm run check`, and the workflow opens a PR against `develop`. Linear's native GitHub integration auto-moves the ticket to "In Review" on PR open and "Done" on merge — we do NOT touch Linear's REST API for status.

Trigger mechanics:

- **Primary trigger:** `state.type === "unstarted"` — either `action: create` directly in Todo, or `action: update` with `updatedFrom.stateId` present (state transition). Keyed on `state.type` (schema-fixed enum) not `state.name` (workspace-configurable), so column renames don't break the webhook.
- **Secondary (legacy) trigger:** `claude:go` label. Kept for pre-research staging workflows; `(unstarted_transition || has_claude_go_label)` is the OR gate.
- **Opt-out:** `claude:skip` label — webhook short-circuits, never dispatches.
- **Model:** Opus 4.7 / `--max-turns 40` is hardcoded in the workflow. Kickoff always writes code, and Seth's operating rule is Opus for code-writing tasks unless the change is line-for-line pre-specified (which a Linear ticket isn't by construction). Typical kickoff cost on Opus: $0.30–$1.50 per ticket. Typical `@claude` reply iteration cost on Opus: $0.10–$0.50. Seth has accepted that cost for code-writing tasks. A `needs-sonnet` downgrade label for trivial tickets is iteration-2 territory — see [`LINEAR-AGENT-RUBRIC.md § When this rubric grows`](LINEAR-AGENT-RUBRIC.md#when-this-rubric-grows).

Where to stage tickets before kickoff: **Backlog or Triage**. Move into Todo when ready to implement; that's the fire.

Playbook for kickoff-Claude: [`LINEAR-AGENT-RUBRIC.md`](LINEAR-AGENT-RUBRIC.md).

#### Iteration 2: `@claude` PR-reply workflow

Alongside the kickoff pipeline, [`.github/workflows/claude-reply.yml`](../.github/workflows/claude-reply.yml) fires a fresh Claude instance on `@claude` mentions in PR/issue/review comments. It's gated to `@Sethmr` as the comment author (prevents exfiltration if the repo ever goes public) and runs at Sonnet 4.6 / `--max-turns 10`. Claude reads the comment, makes changes on the current PR branch, and commits. No additional setup — it uses the same `ANTHROPIC_API_KEY` secret as § 16. Details: see the long header doc block in the workflow file itself.

#### 17a. Secrets checklist

| Name | Where to set | How to generate | Rotation cadence |
|---|---|---|---|
| `LINEAR_WEBHOOK_SECRET` | Railway env + Linear webhook "Signing secret" (same value in both places) | `openssl rand -hex 32` | On suspected leak |
| `GITHUB_DISPATCH_TOKEN` | Railway env only | GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → repo `Sethmr/peanut.gallery`. Permissions: `Contents: Read & write`, `Actions: Read & write`. Expiration: 90 days. | Reminder at ~80 days |
| `ANTHROPIC_API_KEY` | GitHub repo secret (already documented in § 16); reused by the kickoff + reply workflows | — | See § 16 |

All three are environment-level secrets. None of them should land in source control or commit messages.

> Note: an earlier iteration of this pipeline supported a `LINEAR_TRIGGER_LABEL` env override to rename the `claude:go` label. Since the primary trigger is now a **state transition** (not a label), that override no longer exists. The legacy `claude:go` label is still recognized as a secondary trigger but is not configurable.

#### 17b. Linear-side setup

1. **Team.** Create or confirm the Linear team you want kickoff-Claude to work for exists. Note the team key (e.g. `LIN`) — it rides along in the dispatch payload.
2. **Labels.** In the team's label settings, create:
   - `claude:go` — orange/yellow. **Secondary (legacy) trigger.** Apply in Backlog or Triage if you want Claude to fire without waiting for the Todo transition. The webhook ORs this with the state-transition trigger.
   - `claude:skip` — grey. **Opt-out.** Apply to any ticket that's moving into Todo but you DON'T want Claude to pick up. The webhook short-circuits on this label before dispatching.

   The earlier `needs-opus` label is obsolete — the kickoff workflow now defaults to Opus 4.7 / `--max-turns 40` unconditionally (code-writing tasks always get Opus per Seth's operating rule), so elevation-by-label no longer exists. If you already created `needs-opus` on the Linear team, you can safely delete it; the webhook handler still reads it but the workflow ignores the payload field. A `needs-sonnet` downgrade label for cost-sensitive trivial tickets is iteration-2 territory — don't create it yet; the workflow would ignore it.
3. **Webhook.** Settings → API → Webhooks → New webhook:
   - **URL:** `https://peanutgallery.live/api/linear-webhook` (apex domain, NOT `www.` — see notes below).
   - **Resource types:** Issue only (uncheck everything else).
   - **Team:** the team from step 1. Scope tightly to avoid surprise fires on unrelated projects.
   - **Signing secret:** paste the same value you stored in Railway `LINEAR_WEBHOOK_SECRET`.
   - Save. Linear sends a test ping; if the handler is deployed, you'll see `{ ok: true, hint: "POST Linear issue webhooks here" }` on `GET` and a `401` on the ping if the signature doesn't verify (which is correct — the ping doesn't carry a signature).
4. **Confirm Linear's native GitHub integration is connected.** Settings → Integrations → GitHub. This is what auto-moves tickets to "In Review" on PR open and "Done" on merge. If this isn't connected, kickoff-Claude's PR will still open, but ticket status won't update.

**Note on the domain:** `middleware.ts` 308-redirects everything at `peanutgallery.live` EXCEPT `/api/*` to `www.peanutgallery.live` (the static marketing site). So `https://peanutgallery.live/api/linear-webhook` is the right URL; `https://www.peanutgallery.live/api/linear-webhook` would hit the static site and 404. If Railway serves the backend at a `*.up.railway.app` alias that's separate from the apex, use that domain instead.

#### 17c. GitHub-side setup

1. **Repo secret `ANTHROPIC_API_KEY`.** Already required for Claude Triage (§ 16). Kickoff reuses the same secret. If it's set, nothing to do.
2. **Branch protection on `develop`.** Confirm it does NOT block the Claude kickoff bot from pushing feature branches. It shouldn't — branch protection applies to merges into the protected branch, not to heads of feature branches targeting it. The workflow pushes to `claude/*` branches (not protected) and opens a PR against `develop` (protected). Merging remains gated on the normal PR flow.
3. **Dispatch token sanity check.** The fine-grained PAT you generated for `GITHUB_DISPATCH_TOKEN` needs to be authorized against this specific repo. Classic PATs work too but grant broader access — prefer fine-grained. If the webhook returns `500 github dispatch failed` with a 403 body, the token is missing `Contents: Read & write` or `Actions: Read & write` on `Sethmr/peanut.gallery`.

#### 17d. Smoke test

1. Create a Linear issue titled `test: echo hello`, description `Add a one-line comment to README.md explaining this was the kickoff-Claude smoke test.` Leave it in Backlog.
2. Move the ticket into the Todo column (state.type transitions to `unstarted`). That's the fire.
3. Watch `github.com/Sethmr/peanut.gallery/actions/workflows/claude-kickoff.yml`. You should see a new run fire within 10–30 seconds.
4. Expect a PR against `develop` within ~2 minutes (budget for `npm ci` + `npm run check`).
5. Linear auto-moves the ticket to "In Review" once the PR opens (native GitHub integration).
6. Rate-limit does NOT block the first fire — the module-scoped `Map` is empty on cold start. Subsequent fires on the same issue within 30 seconds are skipped with `{skipped: true, reason: "rate_limited"}`.
7. (Optional) To test the `@claude` reply workflow: comment `@claude please add a second comment line mentioning the reply smoke test` on the resulting PR. `.github/workflows/claude-reply.yml` should fire (gated to @Sethmr) and Claude pushes a follow-up commit to the PR branch.

#### 17e. Troubleshooting

- **Webhook returns `401 invalid signature`.** The `LINEAR_WEBHOOK_SECRET` values in Railway and Linear don't match. Copy the Railway value into Linear (or vice versa), then re-save the webhook. Linear regenerates the secret when you click "Regenerate" — that's the footgun.
- **Webhook returns `200 { skipped, reason: "..." }`.** Expected for any event that doesn't match the trigger. Common reasons: `ignored event type`, `not an unstarted-state transition and no claude:go label`, `rate_limited`, or `"claude:skip" label present`.
- **Webhook returns `500 github dispatch failed` with `githubStatus: 401`.** `GITHUB_DISPATCH_TOKEN` is missing or expired. Regenerate in GitHub → Settings → Developer settings.
- **Webhook returns `500 github dispatch failed` with `githubStatus: 403`.** Token lacks `Contents: Read & write` or `Actions: Read & write` on this repo. Regenerate with the correct scopes.
- **Workflow doesn't fire on dispatch.** Check `event_type` matches `linear-kickoff` exactly. Check the Actions tab for the workflow is enabled (Actions → Claude Kickoff → `…` → Enable).
- **`claude-code-action@v1` returns 403.** `ANTHROPIC_API_KEY` is missing or revoked at the provider. See § 16 rotate steps.
- **PR never opens but workflow shows "success."** Kickoff-Claude exited without committing. Check the workflow logs — likely the task required a forbidden action (editing a protected file, adding an unrequested dep, etc.), and kickoff-Claude correctly refused. `/tmp/pr-body.md` should show why.

