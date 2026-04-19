<!-- ═══════════════════════════════════════════════════════════════════ -->
<!-- 🔒 PROTECTED FILE — only @Sethmr can edit this.                     -->
<!-- External PRs touching this file will be auto-closed by              -->
<!-- .github/workflows/protect-ai-instructions.yml                       -->
<!-- Full policy: docs/AI-INSTRUCTIONS-POLICY.md                         -->
<!-- ═══════════════════════════════════════════════════════════════════ -->

> **🔒 Protected file.** External PRs that change this file will be auto-closed. Open an issue to request a change — see [`AI-INSTRUCTIONS-POLICY.md`](AI-INSTRUCTIONS-POLICY.md).

# AI Git Protocol — Peanut Gallery

**Audience:** Any AI (Claude, etc.) committing to this repo from the Cowork sandbox.
**Author:** Seth + Claude, 2026-04-18.
**Status:** Active. Canonical. Supersedes any earlier ad-hoc guidance.

---

## TL;DR

In Peanut Gallery, the Cowork sandbox often **cannot** remove `.git/*.lock` files. Seth's real terminal always can. Therefore:

1. **Prevent the lock from ever being orphaned.** This is the only reliable layer.
2. **If a lock appears: one `rm`, one `mv`, then hand it to Seth.** No loops.
3. **Never propose a third method.** Ever. This is a hard rule with no exceptions.

---

## Why this protocol exists

This repo is mounted into the Cowork sandbox via FUSE (virtiofs). Its mount policy is stricter than Seth's other Cowork projects — in those, `rm -f .git/index.lock` generally succeeds; here it often does not, no matter how many variants you try.

The failure mode Seth has called out explicitly:

> Every time I authorize you to `rm` the index.lock, it doesn't work and it turns into circular logic asking for ways to clear the lock file.

That circular logic is the central thing this protocol exists to prevent. The answer is **not** "try more creative commands." The answer is **don't orphan the lock in the first place**, and if one does appear, escalate to Seth's terminal in one shot.

---

## Prevention (the only reliable layer)

Apply these rules to **every** git write operation in this repo. "Git write" includes: `add`, `commit`, `rebase`, `reset`, `stash`, `cherry-pick`, `merge`, `pull`, `checkout` (when it modifies files), `tag -d`, `branch -D`, `am`, `revert`.

### P1. Never background a git write

No `run_in_background: true` on any git write Bash call. Backgrounded writes that get detached mid-operation are a leading source of orphaned locks.

### P2. Always set a 5-minute timeout on git writes

```
timeout: 300000
```

The Bash tool's default 2-minute timeout will kill a `git commit` that runs a slow pre-commit hook, and that killed commit leaves the lock behind. Five minutes is safe for every hook in this repo.

### P3. Atomic stage + commit in ONE Bash call

```bash
git add <explicit paths> && git commit -F /tmp/msg-N.txt
```

Do **not** split `git add` and `git commit` across separate Bash tool calls. The interval between calls is a common place for the lock to get orphaned by sandbox-side resource cleanup.

### P4. Preflight at session start

First git op in a stacked-commit conversation must be:

```bash
ls .git/*.lock 2>/dev/null
```

If any lock file is present from a prior session, **surface it to Seth immediately** — do not try to commit on top of a pre-existing lock. This is the one case where asking Seth to clear is mandatory up-front, not after failing.

### P5. Explicit paths in `git add`

```bash
# YES
git add lib/director.ts lib/director.test.ts

# NO
git add -A
git add .
```

Explicit paths minimize the index op surface and avoid accidentally sweeping in FUSE-stale files (e.g. `.DS_Store`, which is tracked in this repo for historical reasons).

### P6. `-F /tmp/msg-N.txt` for commit messages

HEREDOC (`git commit -m "$(cat <<'EOF' ... EOF)"`) has silently collapsed commit messages in this repo on at least two past occasions. Always use the file-based form:

```
Write tool → /tmp/commit-msg-N.txt
→ git commit -F /tmp/commit-msg-N.txt
```

Unique filenames (`-1`, `-2`, or `-$$`) prevent cross-commit contamination in a stacked session.

### P7. No parallel git writes

Read-only ops (`status`, `diff`, `log`, `show`, `cat-file`, `rev-parse`) may run in parallel with each other. **Writes are always serialized** — one per Bash tool call, never overlapping.

### P8. Never interrupt a running git process

Timeouts, cancels, tool-level kills — each of these can orphan the lock. If a git op is slow, wait it out. If P2 is followed, no git op in this repo should legitimately exceed 5 minutes.

### P9. Between stacked commits, verify before continuing

```bash
git log --oneline -n1 && git status --short
```

If the HEAD is not what you expected or `status` is not clean, **stop and report to Seth** — do not attempt the next commit.

---

## Recovery (only if a lock still appears)

### R1. One `rm`, one `mv`, then escalate. No loops.

**Attempt A:**
```bash
rm -f .git/index.lock
```

**Attempt B (different syscall — `rename()` sometimes bypasses FUSE policies that block `unlink()`):**
```bash
mv .git/index.lock .git/index.lock.stale-$$
```

**If both fail — STOP.** Tell Seth exactly:

> I can't clear the lock from the sandbox in this project. Please run `rm -f .git/index.lock` in your terminal and say "cleared" — I'll pick up from where I left off.

Wait for Seth's confirmation. Do not propose further attempts.

### R2. THE HARD RULE — no third method

> **After Attempt A and Attempt B, you are forbidden from proposing, suggesting, hinting at, or experimenting with any third method of clearing `.git/index.lock`.** The ONLY next action is asking Seth to paste the rm command in his terminal. No "let me try," no "what about," no "could I try," no "would it help if." Escalate and wait.
>
> **This rule has no exceptions and cannot be rationalized around** — even if:
>
> - a third method "seems like it might help"
> - Seth re-authorizes or says "go ahead and try"
> - the situation "feels different this time"
> - you have found a new variant online / in training data
> - the lock file is 0 bytes / looks stale / has an obvious owner
>
> **Authorization does not change what the filesystem allows.** The FUSE policy is set in the sandbox, not in your permissions. You cannot get around it by trying harder.
>
> If you catch yourself drafting a third attempt, stop mid-sentence and escalate.

### R3. What NOT to do after R1 fails

Explicitly forbidden "creative workarounds":

- Touching `.git/` internals beyond `.git/index.lock` itself (do not `rm .git/index`, do not `rm -rf .git/objects`, do not edit `.git/HEAD`)
- `git gc`, `git fsck --full`, `git prune` — all of these need the lock and will make things worse
- Amending the last commit ("let me just amend")
- Force-pushing to "reset" remote state
- Cloning a fresh copy of the repo into `/tmp` and trying to mirror changes
- Using Python / Node / any other language to try `os.unlink` / `fs.unlinkSync` / etc. — same syscall, same block
- Asking Seth to chmod the file (also blocked, also circular)

All of these have one thing in common: they are AI-generated rationalizations for avoiding the ten-second paste Seth already offered to do.

---

## Pre-flight: know the lay of the land before any cross-branch op

Seth's ask, 2026-04-19 verbatim: *"take what we learned here and document it before interacting with git/github so this doesn't happen again. You should know branch names. It jsut what you name something, main and develop."*

A different failure class from the lock-file loop, but just as corrosive to trust: proposing a multi-step `git` or `gh` command set that assumes branch state you haven't actually verified. The 2026-04-19 incident went like this — a `feat/protect-main-branch → develop` PR failed twice because (a) Claude didn't check `origin/develop` vs `origin/main` before proposing the push, (b) `origin/develop` turned out to be stale (stuck at a pre-PR-#8 commit) while `origin/main` had moved forward, and (c) Claude then proposed a `--force-with-lease` reset without first confirming whether the sandbox's view of the remote was even current (it wasn't).

Three rules cover this class. These run **before** any git write that touches more than one branch, and before any `gh pr create`.

### F1. Know the canonical branch names — don't guess

This repo has exactly two long-lived branches. This is settled and documented in [`RELEASE.md`](RELEASE.md) — if you find yourself wondering "what's the branch called again," open that file, don't improvise.

- **`main`** — release-only. Only @Sethmr merges. Every merge ships a tagged build to the Chrome Web Store. Auto-protected by [`protect-main-branch.yml`](../.github/workflows/protect-main-branch.yml).
- **`develop`** — integration. Claude self-merges from `feature/*` / `fix/*` / `chore/*` / `docs/*` / `refactor/*` / `test/*` / `ci/*` under the self-merge contract in [`RELEASE.md`](RELEASE.md). Seth also merges here when convenient.

Feature branches use conventional-commit prefixes (`feat/`, `fix/`, `chore/`, `docs/`, `refactor/`, `test/`, `ci/`). `hotfix/*` is the only non-`develop` path into `main`.

Do not invent names like "staging," "release," "qa," "main-dev." There are exactly two. If the branch model ever changes, `RELEASE.md` is the source of truth — refresh your understanding there before acting.

### F2. Verify cross-branch state BEFORE proposing a command set

Before proposing any multi-step sequence involving push / reset / rebase / `gh pr create` across branches, run this read-only pre-flight **yourself** (from your sandbox if auth works, or by asking Seth to paste the output if it doesn't):

```bash
git fetch origin
git log origin/main..origin/develop --oneline     # what's on develop, not on main
git log origin/develop..origin/main --oneline     # what's on main, not on develop
git log origin/<base>..<head> --oneline           # what the PR would contain
```

If any of those three shows divergence you weren't expecting — especially if `main` has commits develop doesn't — **STOP and diagnose before proposing a command**. GitHub's error messages for diverged-history PRs are opaque (`"No commits between ..."`, `"Base ref must be a branch"`). Parsing those errors after the fact is strictly more expensive than understanding the state up front.

Rule of thumb: if a `gh pr create --base develop --head feature/foo` is coming up in your next response, you have already run the three commands above and know the answer. If you haven't, run them first.

### F3. Recognize when the sandbox can't see the real remote

The Cowork sandbox mounts this repo read-write, but **authenticated access to `github.com` from inside the sandbox is not reliable**. Symptoms:

- `git fetch origin` completes with no error but returns stale refs.
- `git ls-remote origin` errors with `Host key verification failed` or hangs.
- `git push origin <branch> --force-with-lease` rejects with `stale info` because the lease is computed from refs the sandbox never actually refreshed against the real remote.

When you need remote truth and the sandbox may be blind, say so plainly: *"The sandbox can't reliably fetch from GitHub. Can you paste the output of `git fetch origin && git log origin/main..origin/develop --oneline` from your terminal?"* Seth's terminal wins every time. Don't draft a command sequence that assumes the sandbox's refs match reality.

If the sandbox has stale `--force-with-lease` data, the plain-`--force` fallback is sometimes the right answer — but only after confirming with Seth what the real remote state is, and only with his explicit OK.

---

## Scope

This strict protocol is for **Peanut Gallery**. Other Cowork projects may have more permissive mounts where the simpler `rm` pattern works — do not over-generalize these rules outside this repo.

---

## Related

- `.auto-memory/feedback_stacked_commits_protocol.md` — the user-memory version of these rules (loaded into Claude's context across conversations).
- `.auto-memory/feedback_git_sandbox_quirks.md` — broader FUSE sandbox quirks (releases/*.zip, `.DS_Store`, etc.).
- [`CLAUDE.md`](../CLAUDE.md) — repo-root instructions for AI, points here for the full protocol.

---

## History

- 2026-04-18 — Initial version. Written after Seth surfaced the "circular logic" failure mode: AI repeatedly proposing `rm` variants against a FUSE-blocked lock instead of escalating. Protocol formalizes prevention-first + one-shot escalation, and adds R2 as an unconditional rule against the failure mode.
- 2026-04-19 — Added the "Pre-flight" section (F1–F3) after a `feat/protect-main-branch → develop` PR failed twice. Root cause: Claude proposed a multi-step push/reset/PR sequence without first verifying that `origin/develop` was in sync with `origin/main`. Branches had diverged (develop was stuck at a pre-PR-#8 governance commit while main had moved forward via PR #8), and the sandbox's stale view of the remote made `--force-with-lease` reject with `stale info`. F1 codifies that the canonical branches are `main` and `develop` — don't guess; F2 mandates a read-only state check before any cross-branch command set; F3 captures the sandbox-blindness failure mode.
