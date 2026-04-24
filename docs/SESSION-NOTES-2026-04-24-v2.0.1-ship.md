# Session notes — 2026-04-24 (late) · v2.0.1 ship

**Status summary.** v2.0.1 "The Gallery — compliance pass" is **merged to
main**, tagged `v2.0.1`, and packed at
[`releases/peanut-gallery-v2.0.1.zip`](../releases/peanut-gallery-v2.0.1.zip)
(940K, manifest 2.0.1). All four pointers — `main` / `develop` /
`release/v2.0.1` / `v2.0.1` tag — are at commit `240f59a`. **Seth has
not yet uploaded to the Chrome Web Store**; that's the one remaining
step and it's his to do. The site repo is live at
[`peanut.gallery.site` · `161b051`](https://github.com/Sethmr/peanut.gallery.site/commit/161b051)
with the Brave-deprecation copy sweep, cost-phrasing sweep, and
install-guide rewrite all shipped.

**What to read first in the next session.** This document, then
[`legal-research/BRIEF-2026-04-24.md`](../legal-research/BRIEF-2026-04-24.md) if
the Plus legal thread warms up. Start with "Ship steps still owed by
Seth" and "What's landed in v2.0.1" below.

---

## Release state at session-end

| Manifest | Location | CWS? |
|---|---|---|
| `v1.5.3` "The Cast" | last wide CWS rollout (2026-04-20) | live |
| `v2.0.0` "The Gallery" | absorbed into v2.0.1; never shipped standalone | no |
| **`v2.0.1` "The Gallery — compliance pass"** | `main` + `develop` + `release/v2.0.1` + tag `v2.0.1` at `240f59a` | **packed, pending upload** |

`main` reopened for the first time since 2026-04-20 via the fast-forward merge of [release/v2.0.1 → main](https://github.com/Sethmr/peanut.gallery/pull/134). 129 commits preserved with original SHAs (no merge commit, no squash, no rebase replay).

---

## What's landed in v2.0.1

Summarized; [`CHANGELOG.md`](../CHANGELOG.md) is the canonical source.

### Feature / UX
- **BYOK onboarding wizard** — expanded-by-default 3-step stepper (Deepgram → Anthropic → xAI) in the Backend & keys drawer. The wizard's paste fields ARE the canonical BYOK inputs; no mirror. Consolidation commit (`860de91`) replaced the old separate `.key-row` blocks; the wizard inputs carry the canonical ids (`deepgramKey` / `anthropicKey` / `xaiKey`) that the rest of the extension reads.
- **Always-visible AI disclosure** — masthead "AI" stamp in the top rail + one-line italic strip below the masthead ("AI-generated parody of public figures — not real people"). Satisfies Anthropic AUP line 146 + right-of-publicity framing.
- **"Delete this take"** feed-menu action — destructive red-accent item below a rule separator; removes entry from `feedEntries`, clears DOM, clears any pin/vote state, emits `sendFeedback("delete", entryId)` as a **strong-negative** signal (ranked above `downvote`). Server validator at [`app/api/feedback/route.ts`](../app/api/feedback/route.ts) accepts `delete` in `VALID_ACTIONS`.
- **Tutorial redesign** — triple-CTA terminal: **Try now / Get my own keys / Peanut Gallery Plus** (the third is muted dashed-border tertiary, fires the shared "Coming soon" modal). Skip on non-final cards now jumps to the final CTA (doesn't close). "Done" is gone as a button label. "Get my own keys" launches a walkthrough that **injects** each wizard step's DOM directly into the tutorial card itself (the card literally becomes the wizard step) via `walkthroughParking` + `restoreAllWalkthroughSteps`.
- **Lineup drawer consolidation** — Room volume + mute-a-critic folded into the Lineup section; the standalone "Mute a critic" drawer tile is gone. Drawer menu 8 → 7 tiles. Every persona-behavior knob now lives under one roof.

### Compliance / legal
- **Plus tab feature-flagged off in production** — tab stays visible for discoverability but click fires a branded "Coming soon" modal via `openPlusComingSoonModal()`. Persisted `pgBackendMode: "plus"` silently degrades to `"demo"` on load. Paired with `ENABLE_SUBSCRIPTION=false` on Railway. Plus deferred to v2.5+ pending either reseller approval or a pre-paid BYOK-relay rearchitecture (Anthropic §D.4 + Deepgram §2.3(c) driven).
- **Deepgram `mip_opt_out=true`** on every WebSocket connection — makes the Privacy Policy's "audio streamed + discarded" claim true under Deepgram MSA §3.1.
- **ToS + Privacy rewrite** — shipped in the site repo under the same v2.0.1 tag. Manu Games LLC entity, new sections for AI output + persona framing, Provider usage policies, AI training, Export + sanctions, DMCA safe harbor.
- **DMCA agent registered** at copyright.gov (Manu Games LLC, 2026-04-24, $6 / 3-year period).
- **Cloudflare mail aliases** — `dmca@` + `abuse@` + `postmaster@` + `support@` added; `legal@` + `privacy@` + `security@` + `seth@` were already live.

### Removed
- **Brave Search deprecated.** xAI Grok Live Search (Responses API with `web_search` tool) is now the sole fact-check grounding path. One xAI key covers both persona generation AND fact-check. Net −228 LOC across extension + backend. Back-compat preserved server-side (old extensions that still send `X-Brave-Key` / `X-Search-Engine` headers are silently ignored).

### Cost phrasing
- Tightened BYOK cost from "~$1.15 per 2-hour podcast" to **"~$1 per hour"** everywhere (ext README + site index + pricing + install + plus/cancelled + JSON-LD + `marketing/cws-listing.md` + `docs/SELF-HOST-INSTALL.md`). Rounded to ~$1/hour until a real post-Brave-removal session is measured; conservative enough to absorb any delta.

### Install guide rewrite
- [`site/install/index.html`](https://www.peanutgallery.live/install/) rewritten for non-developers. Dropped jargon (`chrome.tabCapture`, service worker, side-panel API, BYOK abbreviation, MIT-licensed tech-talk). Visual cues a non-dev can follow ("the small puzzle-piece icon near the top-right of Chrome, just left of your profile picture"). New "What's an API key?" FAQ entry. FAQ trimmed from dev-leaning to non-dev questions. Cost line aligned to ~$1/hour. Plus flagged as "coming soon."

### Bug fixes
- **Tutorial action rows both visible on every step** — `.tutorial-card-actions { display: flex }` was beating the UA `[hidden]{display:none}`. Added `!important` override + belt-and-suspenders direct-hide on `#tutorialSkipBtn` for the final CTA card.
- **Plus "Coming soon" modal body rendered literal `<strong>` tags** — `openPromptModal` writes body via `textContent`. Rewrote with punctuation-only emphasis.
- **SUBSCRIPTION_CAP_REACHED / INVALID_KEY / DISABLED drawer UX** — these rejection paths were hidden behind the drawer as invisible `#errorBanner` text. Now route through a branded modal.
- **Tutorial copy drift vs. current drawer** — Welcome "Six submenus" → real count (7). Tap-a-response named Export + Appearance only; added Privacy + Feedback & bugs to match.
- **AI-disclosure strip wrapping** on narrow sidepanels — pulled to 10px serif + `white-space:nowrap` + ellipsis guard; tightened copy.

---

## Ship steps still owed by Seth

1. **Upload [`releases/peanut-gallery-v2.0.1.zip`](../releases/peanut-gallery-v2.0.1.zip) to the Chrome Web Store developer console.** Manifest bumped (`2.0.1 > 1.5.3` currently published); no version conflict.
2. **Paste listing copy** from [`marketing/cws-listing.md`](../marketing/cws-listing.md) into the developer console description field — updated to "three providers" + "~$1 per hour."
3. **Eyeball screenshots.** UI has changed meaningfully since v1.5.3: masthead "AI" stamp, AI-disclosure strip below the masthead, restructured Lineup section with Room volume + mute tiles folded in, 3-step wizard replacing the old BYOK row layout. If any CWS-gallery screenshots feel stale, refresh them.
4. **Leave "Mature content" unchecked** (decision made this session — Peanut Gallery is commentary, not adult content; both model providers carry safety training; TWiST pack is straight-professional; family-filter discoverability loss isn't worth it; can be flipped retroactively if a reviewer insists).

---

## Uncommitted work in the site repo (pre-dates this session)

Site `main` is pushed clean at `161b051`, but the local working tree has larger uncommitted work that **looks like a panel-preview rework started earlier today** (file timestamps 14:17–14:28 today; session started ~15:00):

```
M  panel/index.html              ← 435 insertions / 305 deletions, ~rewrite
?? assets/panel-preview.css      ← 29 KB new file
?? assets/peanut-mascots.js      ← 17 KB new file
```

**Not mine to commit or push without Seth's sign-off.** Flagged to him at session-end; he opted to leave them uncommitted rather than ship mid-session. Next session: ask whether to commit as-is, stash, iterate, or branch these.

---

## Open threads + deferred items

### Filed this session
- **Issue [#133](https://github.com/Sethmr/peanut.gallery/issues/133) — Peanut Gallery Plus legal blockers + call for pro-bono legal help.** Summarizes the 2026-04-24 brief's findings (Anthropic §D.4 + Deepgram §2.3(c) reseller restrictions, Section 230 post-*Anderson*/*Garcia*, right-of-publicity exposure, subscription legal plumbing) and invites anyone with AI-service reseller / right-of-publicity / consumer-SaaS subscription / DMCA / media-liability-insurance background to donate pro-bono time. Reach-out paths: comment on the issue or email `legal@peanutgallery.live` with subject `Pro-bono inquiry — …`. Labels: `help wanted` · `question` · `documentation`. Watch this thread in future sessions.

### Deferred / parking lot (unchanged from prior handoff)
- **Baba fact-check-layer pass-rate tuning** — waiting on live-log data from v2.0.1 captures. Queued post-v2.0.1 iteration.
- **Llama 3.3 70B swap on Cerebras** as structural fix for Llama 3.1 8B schema-echo shadow failures. Evaluate post-v2.0.1.
- **Delete `app/privacy/page.tsx`** Next.js dead-code route (308-redirected by middleware; unreachable). Cleanup only.
- **Lemon Squeezy MoR switch** — tied to Plus relaunch at v2.5+.
- **Apache 2.0 relicense** — post-ship decision per Seth.
- **USPTO trademark filing** — post-first-paid-subscriber for first-use-date anchor.
- **Cookie-consent banner** — brief §7D says IP-block EU from Plus funnel is cleaner at <1K subscribers.
- **Formal arbitration clause** — pending counsel review.
- **Plus relaunch architecture** — pre-paid BYOK relay vs. bundled with reseller approvals. Core v2.5 decision.
- **Jason Calacanis consent path** — parked from prior handoff. Revisit when Seth decides to approach directly.

### Cost measurement
- Cost is currently **"~$1 per hour"** everywhere. Arrived at by rounding up the old "~$1.15 per 2-hour podcast" (which was $0.575/hour) because post-Brave-removal fact-check grounding now runs through xAI Grok Live Search (per-source pay-as-you-go) where Brave Search was effectively free under the 2k/month tier. **Next session**: measure a real 1-hour session and update the figure if the conservative guess is too pessimistic (or too optimistic).

---

## One-off lesson from this session — GitHub rebase-and-merge refused a clean branch

When Seth clicked GitHub's **"Rebase and merge"** button on [PR #134](https://github.com/Sethmr/peanut.gallery/pull/134), it reported **"This branch cannot be rebased due to conflicts."** Every local check said clean:

- `git merge-base origin/main release/v2.0.1` = origin/main HEAD (ancestor relationship; fast-forward eligible).
- `git rebase origin/main` locally: `Current branch is up to date.`
- GitHub API: `mergeable: MERGEABLE, mergeStateStatus: CLEAN`.
- All CI checks passed; no branch protection on main; zero merge commits in the 129-commit span.

**Workaround used (clean):** fast-forward from the command line, preserving all 129 commits with original SHAs:

```bash
git fetch origin
git checkout main
git pull origin main --ff-only
git merge release/v2.0.1 --ff-only
git push origin main
```

The `--ff-only` flag refuses anything except a pure fast-forward, so it can't accidentally create a merge commit or replay commits.

**Why GitHub was stuck**: GitHub's rebase-and-merge button always replays each PR commit individually (cherry-pick style) onto the base, even when a pure fast-forward is clean. With 129 commits spanning the 2026-04-20 realign (which included a peanut-spam "realign" commit + a `wip` auto-commit that touch binary `.DS_Store`), the cherry-pick-style replay hit some internal issue even though the cumulative diff was clean.

**Do NOT use "Squash and merge"** as the fallback — broke the release protocol on v1.5.5 per existing memory. Fast-forward via command line is the canonical workaround.

---

## Session continuity note

Next session should:
1. Read this doc top-to-bottom.
2. Decide what to do with the three uncommitted site files (panel-preview rework).
3. Check CWS upload status — has v2.0.1 shipped? Any reviewer feedback to address?
4. Watch issue #133 for community responses (email notifications to `legal@peanutgallery.live`).
5. After the first real v2.0.1 session runs in the wild, measure actual cost and update the "~$1 per hour" figure across ext + site if warranted.

Everything else on the post-v2.0.1 list is backlog.
