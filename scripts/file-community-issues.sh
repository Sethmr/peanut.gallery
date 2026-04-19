#!/usr/bin/env bash
# Files 8 community-facing issues on github.com/Sethmr/peanut.gallery.
# These are the "known manual-refinement" surfaces where outside contributors
# can land meaningful PRs without deep maintainer context.
#
# Run from the repo root after `gh auth login` has been done.
# NOT idempotent — re-running will create duplicate issues. Run exactly once.

set -euo pipefail

REPO="Sethmr/peanut.gallery"

# Ensure labels exist. These calls are idempotent — `|| true` swallows the
# "label already exists" error.
echo "→ Ensuring labels exist..."
gh label create "good first issue" --repo "$REPO" --color "7057ff" --description "Good for newcomers" 2>/dev/null || true
gh label create "help wanted"      --repo "$REPO" --color "008672" --description "Extra attention is needed" 2>/dev/null || true
gh label create "documentation"    --repo "$REPO" --color "0075ca" --description "Docs improvements" 2>/dev/null || true
gh label create "writing"          --repo "$REPO" --color "fef2c0" --description "Copy / voice tuning" 2>/dev/null || true
gh label create "content"          --repo "$REPO" --color "d4c5f9" --description "Persona packs / creative content" 2>/dev/null || true
gh label create "prompt-engineering" --repo "$REPO" --color "c2e0c6" --description "LLM prompt iteration" 2>/dev/null || true
gh label create "testing"          --repo "$REPO" --color "fbca04" --description "Tests and fixtures" 2>/dev/null || true
gh label create "a11y"             --repo "$REPO" --color "e99695" --description "Accessibility" 2>/dev/null || true

echo "→ Filing 8 community issues..."
echo

# ──────────────────────────────────────────────────────────────────────────
# 1. Tune force-react fallback lines
# ──────────────────────────────────────────────────────────────────────────
gh issue create --repo "$REPO" \
  --title "Tune the force-react fallback lines" \
  --label "good first issue,writing,help wanted" \
  --body "$(cat <<'EOF'
## Why
When a user taps a persona avatar (force-react) and the model returns \`\"-\"\` (its pass signal), the engine substitutes a deterministic fallback line so the user never sees an empty bubble. The current fallbacks in \`lib/persona-engine.ts\` are acknowledged placeholders — hedge-shaped, short, but not voiced in-character.

They look like this today:

\`\`\`ts
const FORCE_REACT_FALLBACKS: Record<string, string> = {
  producer: \"Eh — nothing clean on that one. Let me keep my ears open.\",
  troll:    \"Not enough meat on that bone. I'll get the next one.\",
  soundfx:  \"[crickets]\",
  joker:    \"*still writing — hold.*\",
};
\`\`\`

These fire every time a persona tries to pass on a user-initiated tap. They should sound like the archetype's voice — a fact-checker passing, a troll declining to dunk, a sound-FX guy with nothing to cue, a comedy writer with no bit.

## What
- [ ] Read \`docs/SESSION-NOTES-2026-04-18.md\` §4 (\"Principles Seth established this session\") — the model decides HOW not IF; fallbacks are the belt-and-suspenders for \"model tried to refuse a tap.\"
- [ ] Propose 3–5 candidate fallback lines per archetype (producer, troll, soundfx, joker). Keep them short (< 80 chars), archetype-voiced, and fine to see twice in the same session.
- [ ] Pick your favorite 1 per archetype and submit in the PR.
- [ ] Bonus: if an archetype should rotate between multiple lines (so users don't see the same fallback twice), propose a small rotation mechanism in \`firePersona\`.

## Acceptance
- [ ] 4 new fallback lines merged into \`FORCE_REACT_FALLBACKS\`.
- [ ] Each line reads in the voice of its archetype — a first-time user should be able to guess which persona said it.
- [ ] No \"SaaS copy\" voice (\"empowering,\" \"delightful,\" \"next-gen\" — see \`marketing/CLAUDE-DESIGN-BRIEF.md\` for full anti-patterns).
- [ ] \`npm run check\` green.

## Voice references
- \`lib/packs/howard/personas.ts\` — Baba Booey (producer), The Troll, Fred (soundfx), Jackie (joker).
- \`lib/packs/twist/personas.ts\` — Molly Wood (producer), Jason (troll), Lon (soundfx), Alex (joker).

## Files
- \`lib/persona-engine.ts\` — \`FORCE_REACT_FALLBACKS\` table
- \`docs/SESSION-NOTES-2026-04-18.md\` — context + principles
EOF
)"
echo "  ✓ #1 filed"

# ──────────────────────────────────────────────────────────────────────────
# 2. Add issue templates + CONTRIBUTING.md
# ──────────────────────────────────────────────────────────────────────────
gh issue create --repo "$REPO" \
  --title "Add .github/ISSUE_TEMPLATE/ and CONTRIBUTING.md" \
  --label "good first issue,documentation,help wanted" \
  --body "$(cat <<'EOF'
## Why
The repo has no issue templates and no CONTRIBUTING.md. New contributors have no on-ramp; drive-by bug reports are inconsistent; the project looks unwelcoming even though it actively wants community contribution (see the \`help wanted\` issues filed alongside this one).

## What
- [ ] Create \`.github/ISSUE_TEMPLATE/config.yml\` with \`blank_issues_enabled: false\` and a link to discussions if we ever enable them.
- [ ] Create \`.github/ISSUE_TEMPLATE/bug_report.yml\` (YAML form). Fields: version, browser, pack (Howard / TWiST / custom), transcript or YouTube URL (optional), steps to reproduce, expected, actual, pipeline log excerpt (optional — pointer to \`docs/DEBUGGING.md\`).
- [ ] Create \`.github/ISSUE_TEMPLATE/feature_request.yml\`. Fields: problem (not solution), who benefits, acceptance criteria, roadmap alignment (link to \`docs/ROADMAP.md\`).
- [ ] Create \`.github/ISSUE_TEMPLATE/persona_pack.yml\` for new-pack proposals. Fields: show / universe, 4 personas (name + archetype + 1-line personality), sample transcript to test against.
- [ ] Create \`CONTRIBUTING.md\` in the repo root. Should cover: local dev setup (pointer to \`docs/SELF-HOST-INSTALL.md\`), \`npm run check\` gate, pack-authoring pointer (\`docs/ROADMAP.md\` + \`lib/packs/twist/personas.ts\` as reference), commit message style (look at recent \`git log\`), where to put screenshots in issues.

## Acceptance
- [ ] Templates load correctly when clicking \"New Issue\" on GitHub.
- [ ] \`CONTRIBUTING.md\` is linked from the top-level \`README.md\`.
- [ ] No template asks for information the contributor couldn't reasonably know.

## References
- GitHub docs: https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository
- Good example: https://github.com/anthropics/anthropic-sdk-python/tree/main/.github/ISSUE_TEMPLATE
EOF
)"
echo "  ✓ #2 filed"

# ──────────────────────────────────────────────────────────────────────────
# 3. Contribute a new persona pack
# ──────────────────────────────────────────────────────────────────────────
gh issue create --repo "$REPO" \
  --title "Contribute a new persona pack (All-In, Acquired, Lex Fridman, or your choice)" \
  --label "help wanted,content" \
  --body "$(cat <<'EOF'
## Why
Peanut Gallery ships with two packs today: Howard Stern and TWiST. Each pack tunes the product for a specific show's audience at roughly the cost of four persona prompts. Packs are the most asymmetric distribution lever Peanut Gallery has — a well-done pack for a show whose audience we can reach is worth a 10×-more-expensive engineering project.

The \`docs/ROADMAP.md\` v1.7 entry lists day-one pack targets: **All-In** (Chamath, Jason, Friedberg, Sacks), **Acquired** (Ben + David + 2 research-assistant archetypes), **Lex Fridman** (Lex + 3 thematic companions). You can also propose a pack for any show you love — gaming streams, sports podcasts, cooking shows, whatever — as long as the 4-archetype slot system fits.

## What
- [ ] Pick a show / universe you know well. Verify it has ≥ 2 recurring hosts (or ≥ 1 host plus clear thematic archetypes that can pad to 4).
- [ ] Design 4 personas mapped to the archetype slots: \`producer\` (fact-checker), \`troll\` (cynical take), \`soundfx\` (cues / sound reactions), \`joker\` (comedy writer). Each gets: \`name\`, \`role\`, \`systemPrompt\`, \`directorHint\`, \`avatarEmoji\`, \`color\`, \`model\` (\`claude-haiku\` or \`xai-grok-4-fast\`).
- [ ] Create \`lib/packs/<your-pack-id>/personas.ts\` + \`index.ts\` following the pattern in \`lib/packs/twist/\`.
- [ ] Register the pack in \`lib/packs/index.ts\`.
- [ ] Add 3–5 sample fixtures to \`scripts/fixtures/director/\` that exercise the new pack (show the right slot firing on the right trigger).
- [ ] Run \`npm run check\`. Must be green.
- [ ] Smoke-test locally against a real YouTube episode of the show.

## Acceptance
- [ ] 4 personas, each with a distinctive voice — no two sound like the same AI.
- [ ] \`directorHint\` per persona is < 20 words and describes what content makes that persona want to speak.
- [ ] \`systemPrompt\` per persona is \"character sheet + voice guide,\" not \"task list.\" See \`lib/packs/howard/personas.ts\` for reference.
- [ ] Fixtures pass (run: \`npm run test:director\`).
- [ ] \`npm run check\` green.

## Caveats
- **Real-people satire.** If your pack impersonates real public figures, keep it recognizable-but-not-libelous. No fabricated quotes about real crimes or illness. When in doubt, use an archetype (\"the skeptical VC\") instead of a named individual.
- **Trademarked voices.** Don't clone a specific podcast's audio or script lines. Your pack is a fan-made archetype, not an impersonation.
- **Licensing.** All packs merged to this repo are MIT (matches the repo license).

## References
- Reference pack: \`lib/packs/twist/personas.ts\`
- Pack-authoring doc: \`lib/packs/INDEX.md\`
- Roadmap context: \`docs/ROADMAP.md\` → v1.7.0 \"Pack Lab\" section
- Archetype definitions: \`lib/packs/types.ts\`
EOF
)"
echo "  ✓ #3 filed"

# ──────────────────────────────────────────────────────────────────────────
# 4. Iterate ROUTING_SYSTEM_PROMPT
# ──────────────────────────────────────────────────────────────────────────
gh issue create --repo "$REPO" \
  --title "Iterate ROUTING_SYSTEM_PROMPT against canary disagreement transcripts" \
  --label "help wanted,prompt-engineering" \
  --body "$(cat <<'EOF'
## Why
Smart Director v2 (v1.5) uses a short Claude Haiku call per tick to pick the primary persona, with a hard 400 ms budget and a rule-based fallback. The routing prompt (\`ROUTING_SYSTEM_PROMPT\` in \`lib/director-llm.ts\`) was written from first principles; the canary window (48 h of \`ENABLE_SMART_DIRECTOR=true\` traffic) surfaces where it disagrees with the rule-based scorer. That's the source of truth for prompt iteration.

The v1.5.1 roadmap (\`docs/ROADMAP.md\`) calls for classifying 20 disagreement transcripts into *LLM added value / LLM was wrong / coin flip*. If \"wrong\" > 30%, iterate the prompt before anything else.

## What
This issue opens once Seth publishes the canary disagreement dataset (a JSONL extract of \`director_v2_compare\` events where \`agreed=false\`, with transcript context). Until then, contributors can start on the mechanics:

- [ ] Extend \`scripts/test-director.ts\` with a \`--prompt <file>\` flag so a prompt variant can be scored against the fixture suite.
- [ ] Build a small harness (\`scripts/score-routing-prompt.ts\`) that takes a prompt variant + a set of labeled disagreement transcripts and reports: per-slot pick rate, agreement with human label, time to first token.
- [ ] Once disagreement data is available, propose 1–3 prompt variants with fixture regression + canary-replay evidence. Target: no regression on existing fixtures AND ≥ 20% improvement on human-labeled canary disagreements.

## Acceptance
- [ ] Harness lands and is green.
- [ ] Prompt variant merged if (and only if) the evidence supports it. A failed experiment is also a good outcome — write up what you tried in the PR description.
- [ ] \`npm run check\` green. Fixture suite still 17 × 50 passing.

## References
- \`lib/director-llm.ts\` — current \`ROUTING_SYSTEM_PROMPT\`
- \`scripts/test-director.ts\` — harness
- \`scripts/fixtures/director/\` — fixture directory
- \`docs/V1.5-PLAN.md\` §4 — canary target bands
- \`docs/ROADMAP.md\` → v1.5.1 \"Smart Director Polish\"

## Blocked by
Availability of canary disagreement dataset — will be attached to this issue once the 48 h canary completes.
EOF
)"
echo "  ✓ #4 filed"

# ──────────────────────────────────────────────────────────────────────────
# 5. Expand director test fixtures
# ──────────────────────────────────────────────────────────────────────────
gh issue create --repo "$REPO" \
  --title "Expand director test fixtures from real transcripts" \
  --label "help wanted,testing" \
  --body "$(cat <<'EOF'
## Why
The director routing suite is 17 fixtures × 50 runs = 850 regression checks per \`npm run test:director\`. Every new fixture is a regression guard against a real-world edge case. The cheapest way to make Smart Director v2 trustworthy is more fixtures covering more transcript shapes.

## What
Pick a real YouTube episode of a podcast the project supports (Howard / TWiST for now; any pack from issue #3 once merged). For a 30–60 s chunk where you have an opinion about which persona *should* fire:

- [ ] Transcribe the chunk (yt-dlp + whisper, or copy the YouTube auto-captions, or listen + type).
- [ ] Create \`scripts/fixtures/director/<descriptive-name>.json\` following the schema in the existing fixtures.
- [ ] Set \`expect.primary\` to the archetype slot you think should fire, with \`reason\` explaining why.
- [ ] Run \`npm run test:director\`. The fixture should pass green (if it fails, either your annotation is wrong OR you've found a real routing bug — both are valuable).

## Acceptance
- [ ] 1+ new fixture merged.
- [ ] Each fixture is annotated with: pack, transcript source (URL + timestamp), why this edge case matters.
- [ ] Fixture passes 50-run stability (random seeds shouldn't change the routing outcome).
- [ ] \`npm run check\` green.

## Edge cases especially valuable to cover
- Long silence after a big claim (producer should fire on the claim, not the silence).
- Rapid-fire joke setup → punchline (joker should fire on the punchline, not the setup).
- Fact-checkable claim buried in a digression (does producer still pick it up?).
- Obvious sound-cue moment (big laugh, mic drop) — does soundfx fire?
- Aggressive / dismissive take (does troll fire appropriately or over-fire?).

## References
- Existing fixtures: \`scripts/fixtures/director/*.json\`
- Harness source: \`scripts/test-director.ts\`
- Archetype definitions: \`lib/packs/types.ts\`
EOF
)"
echo "  ✓ #5 filed"

# ──────────────────────────────────────────────────────────────────────────
# 6. Accessibility audit of side panel
# ──────────────────────────────────────────────────────────────────────────
gh issue create --repo "$REPO" \
  --title "Accessibility audit of the extension side panel (WCAG 2.1 AA)" \
  --label "help wanted,a11y" \
  --body "$(cat <<'EOF'
## Why
The Chrome extension side panel (\`extension/sidepanel.html\` + \`extension/sidepanel.js\`) has never had a formal accessibility audit. Peanut Gallery's user base includes screen-reader users, keyboard-only users, and low-vision users who want commentary on YouTube content they already consume. The side panel should be navigable without a mouse, announce incoming persona reactions, and meet WCAG 2.1 AA contrast on every surface.

## What
- [ ] Run axe DevTools (or equivalent) against the side panel in a Chrome session with the extension loaded against localhost:3000.
- [ ] Capture the full failure list in a comment on this issue (violation id, element, severity, suggested fix).
- [ ] Open a PR that fixes the high-severity failures first: semantic landmarks, keyboard focus traps, ARIA labels on the persona cards, \`aria-live=\"polite\"\` on the reactions feed.
- [ ] Verify visible focus states exist on every interactive element in both Howard (dark) and TWiST (dark) packs.
- [ ] Confirm color contrast ≥ 4.5:1 for body text and ≥ 3:1 for large text, across both packs' palettes.
- [ ] Verify the force-react tap surface works with keyboard (Space/Enter) and is announced to screen readers.

## Acceptance
- [ ] axe DevTools reports 0 high-severity failures.
- [ ] Keyboard-only user can: open the side panel, trigger force-react, read incoming reactions, open settings, navigate back.
- [ ] Screen reader announces new persona reactions without overwhelming the user (\`polite\`, not \`assertive\`).
- [ ] \`npm run check\` green. No regressions in the existing test suite.

## Out of scope (separate issues welcome)
- Marketing site (\`app/\` / landing page) accessibility — different surface, different concerns.
- Voice / TTS (v1.6 feature, not yet shipped).

## References
- axe DevTools: https://www.deque.com/axe/devtools/
- WCAG 2.1 AA checklist: https://www.w3.org/WAI/WCAG21/quickref/?currentsidebar=%23col_customize&levels=aaa
- \`extension/sidepanel.html\` — structure
- \`extension/sidepanel.js\` — interactions
EOF
)"
echo "  ✓ #6 filed"

# ──────────────────────────────────────────────────────────────────────────
# 7. Token usage + cost meter
# ──────────────────────────────────────────────────────────────────────────
gh issue create --repo "$REPO" \
  --title "Add token usage and cost meter to the side panel" \
  --label "enhancement,help wanted" \
  --body "$(cat <<'EOF'
## Why
Peanut Gallery is BYOK — users supply their own API keys and pay their AI provider directly. Right now there's no visibility into what a session actually costs. A user running Peanut Gallery during a 2-hour podcast has no way to know whether they spent 3 cents or 3 dollars until they check their provider dashboard the next day. A real-time meter would close that loop.

This is a pure visualization / UX task. All the data already exists in telemetry — no new instrumentation needed.

## What
- [ ] Add a collapsed \"Session cost\" row at the bottom of the side panel. Shows: total tokens in / out, estimated cost, session duration.
- [ ] Pull the numbers from existing telemetry: persona firings (\`persona_stream_start\` / \`persona_stream_end\` events log token counts), \`director_v2_compare\` (Haiku routing cost), Deepgram minute count.
- [ ] Price table is user-configurable — default to current public list prices for Haiku / Grok / Deepgram / Brave, but let the user override if they're on a discounted tier.
- [ ] Expandable row shows cost breakdown by component (Deepgram transcription, Claude Haiku persona, Grok persona, search).
- [ ] Warn (non-blocking) if session cost exceeds a user-set cap.

## Acceptance
- [ ] Cost meter shows within ±10% of the real provider-reported cost for the same session.
- [ ] Works across both packs (Howard and TWiST have different Anthropic/Grok mixes).
- [ ] Cap warning fires but does NOT stop the session unless the user explicitly opts in to a hard stop.
- [ ] No secrets leaked (prices come from a static table, not from API calls that would expose rate-card).
- [ ] \`npm run check\` green.

## Nice-to-have (not required for merge)
- [ ] Cost-per-minute indicator alongside total (some users care about the burn rate more than the total).
- [ ] Per-persona cost breakdown (which persona ate the most tokens this session?).

## References
- \`lib/debug-logger.ts\` — telemetry event shapes
- \`logs/pipeline-debug.jsonl\` — sample events (gitignored; check your local logs dir)
- \`extension/sidepanel.html\` / \`extension/sidepanel.js\` — panel structure
- Public pricing: Anthropic (https://www.anthropic.com/pricing), xAI (https://x.ai/api), Deepgram (https://deepgram.com/pricing), Brave Search API
EOF
)"
echo "  ✓ #7 filed"

# ──────────────────────────────────────────────────────────────────────────
# 8. yt-dlp cookie-auth setup guide
# ──────────────────────────────────────────────────────────────────────────
gh issue create --repo "$REPO" \
  --title "End-user setup guide for yt-dlp cookie authentication (for ISSUE-008 users)" \
  --label "documentation,help wanted" \
  --body "$(cat <<'EOF'
## Why
ISSUE-008 in \`docs/DEBUGGING.md\` documents the most common self-host failure mode: YouTube increasingly requires cookie-based authentication for audio stream extraction, and yt-dlp returns 0 bytes silently when it can't authenticate. The fix is a one-line \`.env.local\` addition (\`YT_DLP_COOKIE_BROWSER=chrome\`), but for a non-technical user hitting this for the first time, the current documentation is dense and assumes terminal fluency.

A dedicated user-facing setup guide would turn a 30-minute debugging session into a 2-minute config.

## What
- [ ] Create \`docs/USER-GUIDE-YTDLP-COOKIES.md\`.
- [ ] Open with a symptom description (matches what the user actually sees — \"my transcript area says 'Listening...' forever\").
- [ ] Walk through the fix, per-browser, with screenshots:
  - Chrome: \`YT_DLP_COOKIE_BROWSER=chrome\` + what it does under the hood.
  - Firefox: same with \`firefox\`.
  - Safari, Edge, Brave: same, per their respective values.
- [ ] Cover the \"I use multiple Chrome profiles\" edge case — how to point at the right profile.
- [ ] Cover the \"my browser is locked while Peanut Gallery runs\" edge case — some OSes lock the cookie DB while the browser is open.
- [ ] Explain what data yt-dlp actually reads (not all cookies — only the YouTube domain's session cookie).
- [ ] Link from \`docs/SELF-HOST-INSTALL.md\` in the troubleshooting section.
- [ ] Link from \`docs/DEBUGGING.md\` ISSUE-008 (\"For a user-facing walkthrough, see ...\").

## Acceptance
- [ ] A non-technical user who can follow a guide with screenshots can recover from ISSUE-008 without posting a GitHub issue.
- [ ] Covers all 5 supported browsers (chrome, firefox, safari, edge, brave).
- [ ] Privacy implications of cookie sharing are stated plainly (not buried).
- [ ] Screenshots are actual screenshots (not mockups) and match the current browser versions as of when you write the guide.

## Useful context
- \`docs/DEBUGGING.md\` ISSUE-008 — technical root cause
- \`docs/SELF-HOST-INSTALL.md\` — existing self-host docs (you'll link here)
- yt-dlp upstream docs: https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp
EOF
)"
echo "  ✓ #8 filed"

echo
echo "✅ All 8 issues filed."
echo "   Review at: https://github.com/$REPO/issues"
