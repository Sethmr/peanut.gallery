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
