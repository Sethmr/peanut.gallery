# CLAUDE.md — Peanut Gallery

Instructions for any AI (Claude, etc.) working in this repo. If you are starting work here, read this file and [`INDEX.md`](INDEX.md) first. For the full walkthrough, see [`docs/CONTEXT.md`](docs/CONTEXT.md).

---

## Non-negotiable rules

These are not suggestions. They exist because they have been violated before and it hurt.

### 1. Git index.lock is UNRECOVERABLE from the sandbox in this repo

Peanut Gallery's Cowork mount has a stricter FUSE policy than other projects. **Once `.git/index.lock` is orphaned, the AI typically cannot remove it from inside the sandbox — no matter how `rm` is invoked, no matter how many times Seth authorizes it.** His real terminal can clear it instantly; the sandbox cannot.

Therefore, the entire strategy is **prevent the lock**, and if prevention fails, **escalate to Seth's terminal in one shot — never loop on creative variants**.

Full protocol: [`docs/AI-GIT-PROTOCOL.md`](docs/AI-GIT-PROTOCOL.md). Short version below.

**Prevention (always apply to git writes in this repo):**

- Never background a git write. No `run_in_background` on `git add`, `git commit`, `git rebase`, `git reset`, `git stash`, `git cherry-pick`, `git merge`, `git pull`.
- Always set `timeout: 300000` (5min) on git write Bash calls. Pre-commit hooks killed by the 2-min default are a primary source of orphaned locks.
- Atomic stage + commit in ONE Bash call: `git add <explicit paths> && git commit -F /tmp/msg-N.txt`. Never split across tool calls.
- Preflight at session start: `ls .git/*.lock 2>/dev/null`. If anything is there, surface to Seth BEFORE attempting any work.
- Explicit paths in `git add` only. Never `-A` or `.`.
- Use `-F /tmp/msg-N.txt` for commit messages. HEREDOC has silently collapsed messages in this repo — do not use it.
- No parallel git writes, ever. Read ops (`status`, `diff`, `log`, `show`) may parallel each other.
- Never interrupt a running git process.

**Recovery (if a lock appears — ONE attempt, ONE fallback, then ESCALATE):**

1. `rm -f .git/index.lock`
2. `mv .git/index.lock .git/index.lock.stale-$$` (rename uses a different syscall than unlink; sometimes passes when rm doesn't)
3. **If both fail, STOP. Tell Seth exactly this:** *"I can't clear the lock from the sandbox in this project. Please run `rm -f .git/index.lock` in your terminal and say 'cleared' — I'll pick up from where I left off."* Then wait.

### 2. THE HARD RULE — no third method

> **After attempt 1 (`rm`) and attempt 2 (`mv` rename), I am forbidden from proposing, suggesting, hinting at, or experimenting with any third method of clearing `.git/index.lock`.** The ONLY next action is asking Seth to paste the rm command in his terminal. No "let me try," no "what about," no "could I." Escalate and wait. This rule has no exceptions and cannot be rationalized around — even if a third method "seems like it might help," even if Seth re-authorizes, even if the situation "feels different this time." **Authorization does not change what the filesystem allows.**

If you catch yourself drafting a third attempt, stop mid-sentence and escalate.

### 3. Other quirks documented in memory

- `releases/*.zip` rm also blocked by FUSE — use `/tmp`-then-`cp` pattern. See `scripts/pack-extension.sh` or ask Seth for the workaround.
- `.DS_Store` is tracked (pre-gitignore-tightening). If it sneaks into a commit, leave it. Do not amend-and-force-push to strip it.
- `chmod` / `chown` in the working tree also blocked — don't bother.

---

## Where to read next

- [`INDEX.md`](INDEX.md) — repo map.
- [`docs/CONTEXT.md`](docs/CONTEXT.md) — canonical project context.
- [`docs/AI-GIT-PROTOCOL.md`](docs/AI-GIT-PROTOCOL.md) — full git protocol (source of truth for rules 1–2 above).
- Latest `docs/SESSION-NOTES-*.md` — most recent handoff.

---

## When in doubt

If something about git is about to go sideways, **stop and ask Seth before acting**. Looping through attempts is the failure mode he has explicitly called out. Prevention + one-shot escalation is always cheaper than recovery.

---

## Standing responsibilities

These are not one-off tasks — they're ongoing habits Claude maintains without being asked.

### 1. Proactively draft the `develop → main` release PR when work is release-worthy

Seth has delegated release-PR drafting to Claude. As soon as a batch of work on `develop` crosses the release-worthy threshold (see [`docs/RELEASE.md § What counts as release-worthy`](docs/RELEASE.md#what-counts-as-release-worthy)), Claude opens the `develop → main` PR without waiting for Seth to ask. The PR has a proper `release: vX.Y.Z — <codename>` title, a CHANGELOG-shaped body grouped by commit type, and is either ready-to-merge or `draft` depending on whether it's safe to ship immediately.

Seth reviews + merges. Claude never self-merges into `main`.

### 2. Be kind to contributors, firm on rules

The PR merge-checklist bot ([`.github/workflows/pr-checklist-comment.yml`](.github/workflows/pr-checklist-comment.yml)) exists to help contributors enjoy the process, not to police them. Tone is warm on every comment. Rules are non-negotiable; the presentation of them is always generous. If a contributor seems stuck, Claude drops a human-voice reply alongside the bot — contributors should always feel welcome, even when we're asking them to rebase.
