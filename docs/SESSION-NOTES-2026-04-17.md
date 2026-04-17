# Peanut Gallery — Session Notes (2026-04-17)

> Handoff from a multi-hour session that (1) shipped v1.1.1's QoL features, (2) hit a security snag with embedded demo keys, (3) refactored to server-side demo access, and (4) documented the whole thing.

---

## 1. What shipped in this session

See [`CHANGELOG.md` § 1.1.1](../CHANGELOG.md) for the canonical list. High-level:

- **Silence detection** replaces pause detection end-to-end. 18s transcript-silence threshold, one fire per quiet stretch, cascade cap 2, personas forbidden from saying "pause" and required to use "crickets / dead air." (`lib/transcription.ts`, `lib/director.ts`, `lib/persona-engine.ts`, `lib/personas.ts`, `app/api/transcribe/route.ts`.)
- **Force-react button** with a pure-CSS spinner. Forbids `"-"` pass token so one click always produces a line. (`extension/sidepanel.html`, `extension/sidepanel.js`, `lib/personas.ts`.)
- **Captured-tab banner** in the side panel — live tab title, click to focus source tab. (`extension/sidepanel.html`, `extension/sidepanel.js`, `extension/background.js`.)
- **Server-side demo access.** Extension no longer embeds any API keys. See §3 below — this is the most important architectural change in this session.

v1.1.1 is built and zipped at `peanut-gallery-v1.1.1.zip` in the repo root (88.5 KB). Verified zero keys in the zip via `unzip -p ... | grep -c "sk-ant\|gsk_\|DEMO_DEFAULT"` → 0.

---

## 2. What Jason wants (unchanged from 2026-04-16)

Still the same eight-point spec from [`SESSION-NOTES-2026-04-16.md §1`](SESSION-NOTES-2026-04-16.md). One subtle evolution: point 8 ("pause behavior") is now implemented as **silence** detection (dead air *in the show*), not viewer-spacebar pauses. The current behavior matches the spirit of Jason's spec (personas react to the show going quiet) while being more useful — it also fires during natural lulls in the audio, not just user-initiated pauses.

Current state: the full pipeline is working end-to-end against the hosted backend. Extension zip ready. Ready for Chrome Web Store publish and demo video.

---

## 3. Server-side demo keys — immutable going forward

This is the section to treat as **do not regress**. Full detail is in [`SERVER-SIDE-DEMO-KEYS.md`](SERVER-SIDE-DEMO-KEYS.md); the shorthand:

- Extension has no API keys in its source. Input fields default to empty strings.
- Extension only sets `X-*-Key` headers when the user pasted a value.
- Backend routes resolve keys as `req.headers.get("X-*-Key") || process.env.*`.
- Demo access is provided by the Vercel env vars on `peanutgallery.live`.
- Self-hosters: client-side pre-flight requires user-supplied keys when the configured server URL isn't `peanutgallery.live`.

A previous pass in this session hard-coded demo keys into `extension/sidepanel.js`. GitHub push protection correctly rejected the push. Full post-mortem in [`DEBUGGING.md` → ISSUE-009](DEBUGGING.md). The current architecture is strictly better — no secrets in zip, no secrets in git, rotation is one env-var edit.

**If a future session is asked to "embed the keys for a quick demo" — redirect to setting them as Vercel env vars instead.** Same result for the end user, zero security cost.

---

## 4. Operational hygiene

New (2026-04-17): four demo keys in Vercel env vars (Deepgram, Groq, Anthropic, Brave). Caps configured per provider. See [`OPS.md`](OPS.md) for dashboards, cap locations, and the rotation runbook.

**Post-TWiST rotation is expected.** Anyone who captures the running extension zip during the demo window could theoretically intercept requests mid-flight. Rotating all four keys after the bounty airs is the cheap defensive move — runbook in `OPS.md`.

---

## 5. Finish-strong checklist (updated from 04-16 §5)

Status of the bounty submission as of end-of-session:

- [x] Chrome extension end-to-end capture path — working against hosted backend.
- [x] Persona reactions streaming reliably — the v1.1.1 QoL fixes closed the remaining rough edges.
- [x] Silence / force-react / tab-banner QoL features.
- [x] v1.1.1 zip built and clean of secrets.
- [x] Documentation current (this session).
- [ ] **Chrome Web Store listing.** Upload `peanut-gallery-v1.1.1.zip`, paste store copy, submit for review.
- [ ] **Demo video.** ~60s showing the personas reacting to a live TWiST clip. Capture without keys entered to showcase zero-setup demo flow.
- [ ] **TWiST submission post.** Link to CWS listing + demo video + `peanutgallery.live`.

---

## 6. What's next (roadmap, NOT started)

See [`ROADMAP.md`](ROADMAP.md) for the full menu. Summary: six-item "big plan" covering selectable persona packs (Howard + TWiST), Smart Director v2 with LLM-assisted routing, expanded director logging, a hidden debug panel in the side panel, pack-swap UI, and a typecheck + lint + smoke-test gate. All six are deliberately unstarted pending a greenlight — don't begin without confirming scope.

---

## 7. Documents created or updated this session

| File | Status | What changed |
|---|---|---|
| `CHANGELOG.md` | updated | Added v1.1.1 and v1.1.0 entries above v1.0.0. |
| `docs/DEBUGGING.md` | updated | Appended ISSUE-009 (push protection / demo keys). Bumped "Last updated." |
| `docs/SERVER-SIDE-DEMO-KEYS.md` | new | Architecture + rationale for the key-fallback pattern. |
| `docs/OPS.md` | new | Runbook for rotations, caps, dashboards. |
| `docs/ROADMAP.md` | new | Pending work (greenlight-pending big plan + standalone items). |
| `docs/SESSION-NOTES-2026-04-17.md` | new | This file. |
| `docs/INDEX.md` | updated | Pointers to the new docs. |
| `extension/sidepanel.js` | updated | Removed `DEMO_DEFAULT_KEYS`, empty-string defaults, self-host pre-flight guard. |
| `extension/sidepanel.html` | updated | Copy now says "API keys — temporarily optional." |
| `.gitignore` | updated | Added `.commit-msg.txt`. |

---

## 8. Gotchas for the next session

- **The two local commits `6823b82` and `ad451d5` containing the leaked keys were reset before push.** Nothing reached GitHub. But if you `git reflog` you'll still see them locally — don't `git cherry-pick` or `git reset --hard` onto them.
- **Shell heredoc terminator trap.** Multi-line commit messages via `cat <<'EOF' ... EOF` are fragile when pasted from chat. Use `git commit -F .commit-msg.txt` instead — the file approach is what's documented in this repo's convention now. `.commit-msg.txt` is gitignored.
- **`.DS_Store` shows as tracked-and-dirty** on macOS even though `.gitignore` excludes it. It was committed to the repo before the ignore rule was added. Leave it alone unless doing a broader cleanup — `git rm --cached .DS_Store` will fix it but causes churn.
- **Root has stray zip blobs with random names** (e.g. `ziNo7yIz`, `ziJAE9kl`). These are debris from mis-pastes of bash heredocs earlier in development. Safe to `rm`. Not tracked.
